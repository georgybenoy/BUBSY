"""Comprehensive unit and integration tests for temporal validation, session engine,
scoring, rewards, and leaderboard rankings.

Covers:
- Pure Python imports assertion (zero cv2, ultralytics, fastapi, sqlite3 in pure modules).
- Temporal sliding window (isolated spikes, flicker, persistence, uncertainty, bounded buffer).
- Session state machine (valid flow, illegal transitions, out-of-order, inactivity timeout, retry hints, instructed vs verified).
- Deterministic scoring engine (formula, bounds, deductions breakdown, uncertainty rule).
- Reward issuance & qualification (daily cap, timezone awareness, single transaction, duplicate idempotency).
- Compensating reversals (immutable history preservation).
- Transaction rollback on reward failure.
- Leaderboard tie-breaking (FR-LEAD-04).
"""

import ast
import sqlite3
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.database.repositories.teachers_repo import TeachersRepository
from app.services.leaderboard_service import (
    LeaderboardEntry,
    compute_leaderboard_ranks,
    compute_local_date_str,
    compute_period_key,
)
from app.services.reward_service import (
    process_session_reward,
    reverse_session_reward,
)
from app.services.scoring_service import (
    ScoringConfig,
    compute_technique_score,
)
from app.services.session_engine import (
    IllegalStateTransitionError,
    ProtocolConfig,
    SessionEngine,
    SessionInactiveError,
    SessionState,
    SessionStepEvent,
    get_default_protocol_config,
)
from app.vision.gestures import GestureClass
from app.vision.temporal import (
    TemporalConfig,
    TemporalEvaluationResult,
    TemporalSlidingWindow,
    TemporalStatus,
)

# ---------------------------------------------------------------------------
# Test Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_conn() -> sqlite3.Connection:
    """In-memory SQLite database initialized with all migrations."""
    conn = create_connection(":memory:")
    run_migrations(conn=conn)
    return conn


@pytest.fixture
def sample_student(db_conn: sqlite3.Connection) -> dict[str, Any]:
    """Create a sample class and active student for reward testing."""
    with transaction(db_conn) as tx:
        cls_record = ClassesRepository.create(
            tx, name="Class 3A", grade="Grade 3", academic_year="2026-2027"
        )
        student = StudentsRepository.create(
            tx,
            display_name="Alex Turner",
            class_id=cls_record["class_id"],
            school_student_code="S-1001",
        )
    return student


# ---------------------------------------------------------------------------
# 1. Purity and Architecture Tests
# ---------------------------------------------------------------------------


def test_pure_python_modules_have_no_forbidden_imports() -> None:
    """Verify temporal.py, session_engine.py, scoring_service.py do not import OpenCV, YOLO, FastAPI, or DB."""
    pure_module_files = [
        Path("backend/app/vision/temporal.py"),
        Path("backend/app/services/session_engine.py"),
        Path("backend/app/services/scoring_service.py"),
    ]
    forbidden_modules = {
        "cv2",
        "ultralytics",
        "fastapi",
        "sqlite3",
        "app.database",
        "app.database.connection",
    }

    for file_path in pure_module_files:
        assert file_path.exists(), f"File {file_path} must exist"
        tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name not in forbidden_modules, (
                        f"Forbidden import '{alias.name}' found in pure module {file_path}"
                    )
            elif isinstance(node, ast.ImportFrom) and node.module:
                assert not any(
                    node.module == f or node.module.startswith(f"{f}.")
                    for f in forbidden_modules
                ), (
                    f"Forbidden import-from '{node.module}' found in pure module {file_path}"
                )


# ---------------------------------------------------------------------------
# 2. Temporal Sliding Window Tests
# ---------------------------------------------------------------------------


class TestTemporalSlidingWindow:
    """Tests for bounded sliding window predictions and filtering."""

    def test_empty_window_evaluates_to_not_present(self) -> None:
        window = TemporalSlidingWindow()
        res = window.evaluate(GestureClass.PALM_TO_PALM)
        assert res.status == TemporalStatus.NOT_PRESENT
        assert res.agreeing_frames == 0
        assert res.total_frames == 0

    @pytest.mark.parametrize(
        "spike_time,spike_conf",
        [
            (100.0, 0.95),  # High-confidence isolated spike
            (500.0, 0.65),  # Moderate-confidence isolated spike
        ],
    )
    def test_isolated_spikes_are_ignored(
        self, spike_time: float, spike_conf: float
    ) -> None:
        """A single frame of target gesture surrounded by background is ignored."""
        window = TemporalSlidingWindow(
            TemporalConfig(spike_persistence_ms=150.0, spike_ratio_threshold=0.20)
        )
        # 10 background frames
        for t in range(0, 500, 50):
            window.add_prediction(float(t), GestureClass.IDLE_BACKGROUND, 0.9)

        # Single isolated spike of PALM_TO_PALM
        window.add_prediction(spike_time, GestureClass.PALM_TO_PALM, spike_conf)

        # 5 more background frames
        for t in range(550, 800, 50):
            window.add_prediction(float(t), GestureClass.IDLE_BACKGROUND, 0.9)

        res = window.evaluate(GestureClass.PALM_TO_PALM)
        assert res.status == TemporalStatus.NOT_PRESENT
        assert "Isolated spike ignored" in res.details

    def test_sustained_gesture_evaluates_to_supported(self) -> None:
        """Sustained agreeing frames above duration and confidence thresholds are SUPPORTED."""
        config = TemporalConfig(
            min_persistence_ms=800.0,
            min_agreement_ratio=0.70,
            min_confidence=0.60,
        )
        window = TemporalSlidingWindow(config)

        # Feed 30 frames over 1000ms (~33ms delta) of PALM_TO_PALM with 0.85 conf
        for i in range(30):
            window.add_prediction(
                timestamp_ms=i * 33.3,
                label=GestureClass.PALM_TO_PALM,
                confidence=0.85,
            )

        res = window.evaluate(GestureClass.PALM_TO_PALM)
        assert res.status == TemporalStatus.SUPPORTED
        assert res.agreeing_frames == 30
        assert res.agreement_ratio == 1.0
        assert res.persistence_ms >= 800.0
        assert res.mean_confidence >= 0.80

    def test_flicker_below_agreement_ratio_evaluates_to_uncertain(self) -> None:
        """Alternating frames (50% agreement) is below 0.65 threshold, evaluates to UNCERTAIN."""
        config = TemporalConfig(
            min_persistence_ms=800.0,
            min_agreement_ratio=0.65,
            uncertain_ratio_threshold=0.30,
        )
        window = TemporalSlidingWindow(config)

        # Alternating PALM_TO_PALM and IDLE_BACKGROUND over 1000ms
        for i in range(30):
            label = (
                GestureClass.PALM_TO_PALM
                if i % 2 == 0
                else GestureClass.IDLE_BACKGROUND
            )
            window.add_prediction(i * 33.3, label, 0.80)

        res = window.evaluate(GestureClass.PALM_TO_PALM)
        assert res.status == TemporalStatus.UNCERTAIN
        assert 0.40 <= res.agreement_ratio <= 0.60
        assert res.persistence_ms >= 800.0

    def test_low_confidence_evaluates_to_uncertain(self) -> None:
        """Sustained movement with confidence 0.45 (< 0.60 min) evaluates to UNCERTAIN."""
        config = TemporalConfig(
            min_confidence=0.60,
            uncertain_confidence_threshold=0.35,
            min_persistence_ms=500.0,
        )
        window = TemporalSlidingWindow(config)

        for i in range(25):
            window.add_prediction(i * 33.3, GestureClass.PALM_TO_PALM, 0.45)

        res = window.evaluate(GestureClass.PALM_TO_PALM)
        assert res.status == TemporalStatus.UNCERTAIN
        assert res.mean_confidence < 0.60

    def test_buffer_prunes_older_samples_and_bounds_memory(self) -> None:
        """Window prunes frames older than window_duration_ms and caps at max_buffer_size."""
        config = TemporalConfig(window_duration_ms=2000.0, max_buffer_size=50)
        window = TemporalSlidingWindow(config)

        # Feed 100 frames spanning 5000ms
        for i in range(100):
            window.add_prediction(i * 50.0, GestureClass.PALM_TO_PALM, 0.8)

        # Buffer must be bounded to max_buffer_size
        assert window.sample_count <= 50

        # Oldest sample in buffer must not be older than (latest - 2000ms)
        latest_time = 99 * 50.0
        samples = window.get_samples()
        assert all(s.timestamp_ms >= latest_time - 2000.0 for s in samples)


# ---------------------------------------------------------------------------
# 3. Session State Machine Tests
# ---------------------------------------------------------------------------


class TestSessionEngine:
    """Tests for the handwashing session state machine."""

    def test_initial_session_state_and_unassigned_flag(self) -> None:
        engine = SessionEngine(session_id="ses-1", student_id=None)
        assert engine.state == SessionState.IN_PROGRESS
        assert engine.is_unassigned is True
        assert engine.current_step_index == 0
        assert engine.current_step is not None
        assert engine.current_step.step_code == "PREPARATION"

        assigned_engine = SessionEngine(session_id="ses-2", student_id="stu-1")
        assert assigned_engine.is_unassigned is False

    def test_full_valid_handwashing_sequence(self) -> None:
        """Complete workflow: preparation -> 6 rubbing steps -> rinse -> dry."""
        engine = SessionEngine(session_id="ses-happy", student_id="stu-1")
        t = 0.0

        # Step 0: PREPARATION (Instructed, not AI verified)
        prep_event = engine.advance_instructed_step(current_time_ms=t, duration_ms=5000)
        assert prep_event.step_code == "PREPARATION"
        assert prep_event.confidence_summary is None
        assert prep_event.is_verified is False
        assert engine.current_step_index == 1
        t += 5000.0

        # Steps 1 to 6: The six WHO rubbing steps
        rubbing_steps = [
            ("PALM_TO_PALM", GestureClass.PALM_TO_PALM),
            ("PALM_OVER_DORSUM", GestureClass.PALM_OVER_DORSUM),
            ("FINGERS_INTERLACED", GestureClass.FINGERS_INTERLACED),
            ("BACKS_OF_FINGERS", GestureClass.BACKS_OF_FINGERS),
            ("THUMB_RUBBING", GestureClass.THUMB_RUBBING),
            ("FINGERTIPS", GestureClass.FINGERTIPS),
        ]

        for step_code, gesture in rubbing_steps:
            assert engine.current_step is not None
            assert engine.current_step.step_code == step_code

            # Accumulate 3000ms of validated gesture evidence
            # Each chunk 1000ms delta
            for _ in range(3):
                temp_result = TemporalEvaluationResult(
                    status=TemporalStatus.SUPPORTED,
                    target_gesture=gesture,
                    total_frames=30,
                    agreeing_frames=30,
                    agreement_ratio=1.0,
                    persistence_ms=1000.0,
                    mean_confidence=0.88,
                )
                event = engine.process_gesture_evidence(
                    temp_result, current_time_ms=t, frame_delta_ms=1000.0
                )
                t += 1000.0

            assert event is not None
            assert event.step_code == step_code
            assert event.result == "recognized"
            assert event.is_verified is True
            assert event.duration_ms >= 3000

        # Step 7: RINSE (Instructed)
        rinse_event = engine.advance_instructed_step(
            current_time_ms=t, duration_ms=5000
        )
        assert rinse_event.step_code == "RINSE"
        assert rinse_event.is_verified is False
        t += 5000.0

        # Step 8: DRY (Instructed) -> Transitions session to COMPLETED
        dry_event = engine.advance_instructed_step(current_time_ms=t, duration_ms=5000)
        assert dry_event.step_code == "DRY"
        assert engine.state == SessionState.COMPLETED

    def test_single_event_cannot_advance_multiple_steps(self) -> None:
        """One event cannot advance more than one step under any condition."""
        engine = SessionEngine(session_id="ses-single-step", student_id="stu-1")
        # Advance preparation
        engine.advance_instructed_step(current_time_ms=1000.0)
        assert engine.current_step_index == 1

        # Massive evidence for PALM_TO_PALM
        temp_result = TemporalEvaluationResult(
            status=TemporalStatus.SUPPORTED,
            target_gesture=GestureClass.PALM_TO_PALM,
            total_frames=100,
            agreeing_frames=100,
            agreement_ratio=1.0,
            persistence_ms=10000.0,
            mean_confidence=0.99,
        )
        # Advance step 1
        event = engine.process_gesture_evidence(
            temp_result, current_time_ms=5000.0, frame_delta_ms=5000.0
        )
        assert event is not None
        assert event.step_code == "PALM_TO_PALM"
        # Must advance by exactly ONE step
        assert engine.current_step_index == 2

    def test_out_of_order_gestures_do_not_advance_and_are_recorded(self) -> None:
        """A future gesture does not advance the current step; increments out_of_order."""
        engine = SessionEngine(session_id="ses-ooo", student_id="stu-1")
        engine.advance_instructed_step(
            current_time_ms=1000.0
        )  # Now at PALM_TO_PALM (step 1)

        # Student performs step 5 (THUMB_RUBBING) out of order
        temp_result = TemporalEvaluationResult(
            status=TemporalStatus.SUPPORTED,
            target_gesture=GestureClass.THUMB_RUBBING,
            total_frames=30,
            agreeing_frames=30,
            agreement_ratio=1.0,
            persistence_ms=1000.0,
            mean_confidence=0.9,
        )
        ret = engine.process_gesture_evidence(
            temp_result, current_time_ms=2000.0, frame_delta_ms=1000.0
        )

        assert ret is None
        assert engine.current_step_index == 1  # Did NOT advance!
        assert engine.out_of_order_count == 1

    def test_uncertain_evidence_emits_retry_and_retains_step(self) -> None:
        """Uncertain evidence emits a RETRY event rather than advancing or failing."""
        engine = SessionEngine(session_id="ses-retry", student_id="stu-1")
        engine.advance_instructed_step(current_time_ms=1000.0)

        temp_result = TemporalEvaluationResult(
            status=TemporalStatus.UNCERTAIN,
            target_gesture=GestureClass.PALM_TO_PALM,
            total_frames=30,
            agreeing_frames=15,
            agreement_ratio=0.50,
            persistence_ms=800.0,
            mean_confidence=0.55,
            details="Borderline confidence and flicker",
        )
        event = engine.process_gesture_evidence(
            temp_result, current_time_ms=2000.0, frame_delta_ms=500.0
        )

        assert event is not None
        assert event.result == "retry"
        assert event.hint is not None
        assert "Please keep hands clearly in camera view" in event.hint
        assert engine.current_step_index == 1  # Step retained!
        assert engine.state == SessionState.IN_PROGRESS

    def test_inactivity_timeout_abandons_session(self) -> None:
        """Exceeding inactivity timeout transitions state to ABANDONED."""
        protocol = ProtocolConfig(
            inactivity_timeout_ms=10000,
            steps=get_default_protocol_config().steps,
        )
        engine = SessionEngine(
            session_id="ses-timeout",
            student_id="stu-1",
            protocol=protocol,
            start_time_ms=0.0,
        )

        # Advance step 0 at t=1000ms
        engine.advance_instructed_step(current_time_ms=1000.0)

        # Idle gap of 15000ms (t=16000ms) > 10000ms timeout
        is_abandoned = engine.check_inactivity(current_time_ms=16000.0)
        assert is_abandoned is True
        assert engine.state == SessionState.ABANDONED
        assert engine.failure_reason == "INACTIVITY_TIMEOUT"

        # Subsequent actions on abandoned session fail
        with pytest.raises(SessionInactiveError):
            engine.advance_instructed_step(current_time_ms=17000.0)

    @pytest.mark.parametrize(
        "action,initial_state",
        [
            ("abandon", SessionState.COMPLETED),
            ("interrupt", SessionState.COMPLETED),
            ("interrupt", SessionState.ABANDONED),
        ],
    )
    def test_illegal_state_transitions_raise_error(
        self, action: str, initial_state: SessionState
    ) -> None:
        """Transitions from completed or abandoned states are strictly rejected."""
        engine = SessionEngine(session_id="ses-illegal", student_id="stu-1")
        engine.state = initial_state

        with pytest.raises(IllegalStateTransitionError):
            if action == "abandon":
                engine.abandon()
            elif action == "interrupt":
                engine.interrupt()

    def test_skip_step_marks_skipped_and_advances(self) -> None:
        """skip_step records skipped result and advances step index."""
        engine = SessionEngine(session_id="ses-skip", student_id="stu-1")
        event = engine.skip_step(current_time_ms=2000.0, reason="child_refused")

        assert event.result == "skipped"
        assert event.step_code == "PREPARATION"
        assert engine.current_step_index == 1


# ---------------------------------------------------------------------------
# 4. Deterministic Scoring Service Tests
# ---------------------------------------------------------------------------


class TestScoringService:
    """Tests for deterministic technique scoring and deduction breakdown."""

    def test_scoring_determinism(self) -> None:
        """Identical inputs produce exact identical output across 50 evaluations."""
        events = [
            SessionStepEvent(
                step_code="PALM_TO_PALM",
                sequence_index=1,
                result="recognized",
                duration_ms=5000,
                confidence_summary=0.90,
                is_verified=True,
            ),
            SessionStepEvent(
                step_code="PALM_OVER_DORSUM",
                sequence_index=2,
                result="recognized",
                duration_ms=4500,  # 500ms shortfall
                confidence_summary=0.85,
                is_verified=True,
            ),
        ]
        results = [
            compute_technique_score(
                events, out_of_order_count=1, session_state="completed"
            )
            for _ in range(50)
        ]
        first = results[0]
        for r in results[1:]:
            assert r.base_score == first.base_score
            assert r.final_score == first.final_score
            assert r.total_deductions == first.total_deductions
            assert len(r.deductions) == len(first.deductions)

    @pytest.mark.parametrize(
        "n_completed,expected_steps,ooo_count,expected_base,expected_final",
        [
            (6, 6, 0, 100.0, 100.0),  # Perfect run
            (3, 6, 0, 50.0, 50.0),  # 3 of 6 completed
            (0, 6, 0, 0.0, 0.0),  # 0 completed
            (6, 6, 2, 100.0, 90.0),  # 2 out-of-order gestures (-10 pts)
            (6, 6, 10, 100.0, 80.0),  # Out-of-order capped at -20 pts
        ],
    )
    def test_scoring_formula_and_bounds(
        self,
        n_completed: int,
        expected_steps: int,
        ooo_count: int,
        expected_base: float,
        expected_final: float,
    ) -> None:
        events = [
            SessionStepEvent(
                step_code=f"STEP_{i}",
                sequence_index=i,
                result="recognized",
                duration_ms=5000,
                confidence_summary=0.9,
                is_verified=True,
            )
            for i in range(n_completed)
        ]
        cfg = ScoringConfig(expected_scored_steps=expected_steps)
        res = compute_technique_score(
            events, out_of_order_count=ooo_count, session_state="completed", config=cfg
        )
        assert res.base_score == expected_base
        assert res.final_score == expected_final
        assert 0.0 <= res.final_score <= 100.0

    def test_insufficient_evidence_never_gets_perfect_score(self) -> None:
        """FR-SCORE-10: Insufficient evidence yields uncertain status, capped below 100."""
        # Only 2 steps completed, session incomplete
        events = [
            SessionStepEvent(
                step_code="PALM_TO_PALM",
                sequence_index=1,
                result="recognized",
                duration_ms=5000,
                confidence_summary=0.9,
                is_verified=True,
            ),
            SessionStepEvent(
                step_code="PALM_OVER_DORSUM",
                sequence_index=2,
                result="retry",
                duration_ms=2000,
                confidence_summary=0.5,
                is_verified=False,
            ),
        ]
        res = compute_technique_score(events, session_state="incomplete")
        assert res.is_uncertain is True
        assert res.status in ("incomplete", "uncertain")
        assert res.final_score < 100.0


# ---------------------------------------------------------------------------
# 5. Reward Service Tests (Atomic, Daily Cap, Idempotency, Reversal)
# ---------------------------------------------------------------------------


class TestRewardService:
    """Tests for reward issuance, transaction safety, and history preservation."""

    def test_unassigned_and_non_qualifying_sessions_earn_zero_points(
        self, db_conn: sqlite3.Connection, sample_student: dict[str, Any]
    ) -> None:
        """Unassigned or abandoned sessions earn 0 points and mark qualifies_for_points=0."""
        with transaction(db_conn) as tx:
            # 1. Unassigned session
            unassigned = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=None,
                outcome="completed",
            )
            # 2. Abandoned session
            abandoned = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=sample_student["student_id"],
                outcome="cancelled",
            )

        # Test unassigned
        res_unassigned = process_session_reward(
            db_conn, unassigned["session_id"], technique_score=95.0
        )
        assert res_unassigned["qualifies"] is False
        assert res_unassigned["points_awarded"] == 0
        assert res_unassigned["reason_code"] == "UNASSIGNED_SESSION"

        # Verify session in DB
        sess_row = SessionsRepository.get_by_id(db_conn, unassigned["session_id"])
        assert sess_row is not None
        assert sess_row["qualifies_for_points"] == 0

        # Test abandoned
        res_abandoned = process_session_reward(
            db_conn, abandoned["session_id"], technique_score=95.0
        )
        assert res_abandoned["qualifies"] is False
        assert res_abandoned["points_awarded"] == 0
        assert res_abandoned["reason_code"] == "INCOMPLETE_SESSION"

    def test_duplicate_completion_request_gives_exactly_one_reward_row(
        self, db_conn: sqlite3.Connection, sample_student: dict[str, Any]
    ) -> None:
        """Idempotency: Repeated reward processing returns existing row without duplication."""
        with transaction(db_conn) as tx:
            sess = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=sample_student["student_id"],
                outcome="completed",
            )

        # First call -> awards points
        res1 = process_session_reward(db_conn, sess["session_id"], technique_score=85.0)
        assert res1["status"] == "awarded"
        assert res1["points_awarded"] == 10

        # Second call -> idempotent return
        res2 = process_session_reward(db_conn, sess["session_id"], technique_score=85.0)
        assert res2["status"] == "already_processed"
        assert res2["points_awarded"] == 10

        # Assert exactly ONE row in reward_transactions
        cursor = db_conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM reward_transactions WHERE session_id = ?;",
            (sess["session_id"],),
        )
        assert cursor.fetchone()[0] == 1

    def test_daily_cap_enforcement_using_school_timezone(
        self, db_conn: sqlite3.Connection, sample_student: dict[str, Any]
    ) -> None:
        """A student receives points up to the daily cap (3); 4th attempt earns 0 points."""
        student_id = sample_student["student_id"]
        daily_cap = 3

        for i in range(daily_cap):
            with transaction(db_conn) as tx:
                sess = SessionsRepository.create(
                    tx,
                    kiosk_id="kiosk-1",
                    protocol_version="1.0.0",
                    student_id=student_id,
                    outcome="completed",
                    started_at="2026-10-14T10:00:00+00:00",
                )
            res = process_session_reward(
                db_conn,
                sess["session_id"],
                technique_score=85.0,
                daily_cap=daily_cap,
                school_timezone="UTC",
            )
            assert res["qualifies"] is True
            assert res["points_awarded"] == 10

        # 4th session on the same local date
        with transaction(db_conn) as tx:
            sess_overflow = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=student_id,
                outcome="completed",
                started_at="2026-10-14T15:00:00+00:00",
            )
        res_overflow = process_session_reward(
            db_conn,
            sess_overflow["session_id"],
            technique_score=85.0,
            daily_cap=daily_cap,
            school_timezone="UTC",
        )
        assert res_overflow["qualifies"] is False
        assert res_overflow["points_awarded"] == 0
        assert res_overflow["reason_code"] == "DAILY_CAP_EXCEEDED"

    def test_compensating_reversal_creates_compensating_row_and_preserves_history(
        self, db_conn: sqlite3.Connection, sample_student: dict[str, Any]
    ) -> None:
        """Reversing a reward creates a negative delta row and never edits history."""
        with transaction(db_conn) as tx:
            teacher = TeachersRepository.create(
                tx,
                username="teacher_reversal_admin",
                password_hash="argon2_fake_hash",
                role="teacher",
            )
            sess = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=sample_student["student_id"],
                outcome="completed",
            )

        # 1. Award points
        award_res = process_session_reward(
            db_conn, sess["session_id"], technique_score=92.0
        )
        assert award_res["points_awarded"] == 15
        orig_tx_id = award_res["reward_transaction"]["transaction_id"]

        # Net points before reversal = 15
        net_before = RewardTransactionsRepository.get_student_points_summary(
            db_conn, sample_student["student_id"]
        )
        assert net_before == 15

        # 2. Reverse reward
        rev_res = reverse_session_reward(
            db_conn,
            sess["session_id"],
            teacher_id=teacher["teacher_id"],
            reason="False positive recognition",
        )
        assert rev_res["status"] == "reversed"
        assert rev_res["points_reversed"] == -15

        # 3. Verify original row is unchanged
        orig_row = RewardTransactionsRepository.get_by_id(db_conn, orig_tx_id)
        assert orig_row is not None
        assert orig_row["points_delta"] == 15

        # 4. Verify compensating row exists
        comp_tx = rev_res["compensating_transaction"]
        assert comp_tx["points_delta"] == -15
        assert comp_tx["reason_code"] == "REVERSAL"

        # 5. Net points is now 0
        net_after = RewardTransactionsRepository.get_student_points_summary(
            db_conn, sample_student["student_id"]
        )
        assert net_after == 0

        # 6. Session qualifies_for_points updated to 0
        sess_after = SessionsRepository.get_by_id(db_conn, sess["session_id"])
        assert sess_after is not None
        assert sess_after["qualifies_for_points"] == 0

    def test_transaction_rollback_when_reward_insert_fails(
        self, db_conn: sqlite3.Connection, sample_student: dict[str, Any]
    ) -> None:
        """Database rollback ensures session is not marked qualifying if reward insert fails."""
        with transaction(db_conn) as tx:
            sess = SessionsRepository.create(
                tx,
                kiosk_id="kiosk-1",
                protocol_version="1.0.0",
                student_id=sample_student["student_id"],
                outcome="completed",
            )

        # Simulate exception during reward insertion
        with (
            patch.object(
                RewardTransactionsRepository,
                "create",
                side_effect=sqlite3.OperationalError("Simulated disk error"),
            ),
            pytest.raises(sqlite3.OperationalError),
        ):
            process_session_reward(db_conn, sess["session_id"], technique_score=85.0)

        # Assert session rollback: qualifies_for_points is still 0
        sess_after = SessionsRepository.get_by_id(db_conn, sess["session_id"])
        assert sess_after is not None
        assert sess_after["qualifies_for_points"] == 0


# ---------------------------------------------------------------------------
# 6. Timezone, Period Key, and Leaderboard Tie-breaking Tests
# ---------------------------------------------------------------------------


class TestLeaderboardAndTimezone:
    """Tests for school timezone conversions, period keys, and tie-breaking."""

    @pytest.mark.parametrize(
        "utc_timestamp,tz_name,expected_period,expected_date",
        [
            # Month boundary: 2026-10-31 23:30 UTC
            # In Tokyo (+9), it's 2026-11-01 08:30 AM -> period 2026-11
            ("2026-10-31T23:30:00+00:00", "Asia/Tokyo", "2026-11", "2026-11-01"),
            # In New York (-4 EDT), it's 2026-10-31 07:30 PM -> period 2026-10
            ("2026-10-31T23:30:00+00:00", "America/New_York", "2026-10", "2026-10-31"),
            # Year boundary: 2026-12-31 23:30 UTC
            # In Tokyo, it's 2027-01-01 08:30 AM -> period 2027-01
            ("2026-12-31T23:30:00+00:00", "Asia/Tokyo", "2027-01", "2027-01-01"),
            # In Los Angeles (-8 PST), it's 2026-12-31 03:30 PM -> period 2026-12
            (
                "2026-12-31T23:30:00+00:00",
                "America/Los_Angeles",
                "2026-12",
                "2026-12-31",
            ),
        ],
    )
    def test_timezone_month_and_year_boundaries(
        self,
        utc_timestamp: str,
        tz_name: str,
        expected_period: str,
        expected_date: str,
    ) -> None:
        period_key = compute_period_key(utc_timestamp, tz_name)
        date_str = compute_local_date_str(utc_timestamp, tz_name)
        assert period_key == expected_period
        assert date_str == expected_date

    def test_leaderboard_tie_breaking_per_fr_lead_04(self) -> None:
        """FR-LEAD-04:
        Ties resolved by: 1) higher avg technique score, 2) qualifying-day count.
        Unresolved ties share the same rank.
        """
        entries = [
            # Tied on points with Maya, but higher avg technique score -> Rank 1
            LeaderboardEntry(
                "s1",
                "Leo",
                total_points=100,
                avg_technique_score=95.0,
                qualifying_days_count=8,
            ),
            # Tied on points with Leo, but lower avg technique score -> Rank 2
            LeaderboardEntry(
                "s2",
                "Maya",
                total_points=100,
                avg_technique_score=90.0,
                qualifying_days_count=9,
            ),
            # Tied on points and avg score with Sam, but higher qualifying days -> Rank 3
            LeaderboardEntry(
                "s3",
                "Zoe",
                total_points=80,
                avg_technique_score=88.0,
                qualifying_days_count=7,
            ),
            # Tied on points and avg score with Zoe, but lower qualifying days -> Rank 4
            LeaderboardEntry(
                "s4",
                "Sam",
                total_points=80,
                avg_technique_score=88.0,
                qualifying_days_count=5,
            ),
            # Unresolved tie: identical points, avg score, and days -> Share Rank 5
            LeaderboardEntry(
                "s5",
                "Jack",
                total_points=50,
                avg_technique_score=80.0,
                qualifying_days_count=4,
            ),
            LeaderboardEntry(
                "s6",
                "Emma",
                total_points=50,
                avg_technique_score=80.0,
                qualifying_days_count=4,
            ),
            # Next position receives Rank 7
            LeaderboardEntry(
                "s7",
                "Noah",
                total_points=30,
                avg_technique_score=75.0,
                qualifying_days_count=2,
            ),
        ]

        ranked = compute_leaderboard_ranks(entries)

        assert ranked[0].display_name == "Leo"
        assert ranked[0].rank == 1

        assert ranked[1].display_name == "Maya"
        assert ranked[1].rank == 2

        assert ranked[2].display_name == "Zoe"
        assert ranked[2].rank == 3

        assert ranked[3].display_name == "Sam"
        assert ranked[3].rank == 4

        # Jack and Emma share Rank 5
        jack = next(e for e in ranked if e.display_name == "Jack")
        emma = next(e for e in ranked if e.display_name == "Emma")
        assert jack.rank == 5
        assert emma.rank == 5

        # Noah receives Rank 7
        noah = next(e for e in ranked if e.display_name == "Noah")
        assert noah.rank == 7
