"""Reward points issuance, qualification, and compensating reversal service.

Implements rules per PRD section 7.6 (FR-REW-01 to FR-REW-07) and TESTING.md section 3:
- FR-REW-01: Point eligibility determined by validated completion and technique score.
- FR-REW-02: Daily point cap enforced using school timezone (zoneinfo).
- FR-REW-04: Idempotency: duplicate completion request returns existing transaction.
- FR-REW-07: Compensating reversal transactions that never mutate or delete historical records.
- Single atomic database transaction tying session qualification and reward issuance.
"""

import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.database.connection import transaction
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.settings_repo import SettingsRepository
from app.services.leaderboard_service import (
    compute_local_date_str,
    compute_period_key,
)


class RewardServiceError(Exception):
    """Base exception for reward issuance errors."""


class SessionNotFoundError(RewardServiceError):
    """Raised when target session ID cannot be found."""


class StudentInactiveError(RewardServiceError):
    """Raised when student account is inactive or missing."""


class RewardNotFoundError(RewardServiceError):
    """Raised when attempting to reverse a non-existent reward."""


@dataclass(frozen=True)
class QualificationResult:
    """Outcome of session reward qualification evaluation."""

    qualifies: bool
    points: int
    reason_code: str
    explanation: str


def evaluate_qualification(
    session_data: dict[str, Any],
    technique_score: float,
    is_uncertain: bool,
    daily_count_today: int,
    daily_cap: int = 3,
    min_qualifying_score: float = 70.0,
) -> QualificationResult:
    """Determine whether a session qualifies for leaderboard points.

    Unassigned, incomplete, low-scoring, uncertain, or cap-exceeded sessions
    strictly earn zero points.
    """
    student_id = session_data.get("student_id")
    if not student_id:
        return QualificationResult(
            qualifies=False,
            points=0,
            reason_code="UNASSIGNED_SESSION",
            explanation="Unassigned/anonymous kiosk sessions do not award student points.",
        )

    outcome = session_data.get("outcome")
    if outcome != "completed":
        return QualificationResult(
            qualifies=False,
            points=0,
            reason_code="INCOMPLETE_SESSION",
            explanation=f"Session outcome is '{outcome}'; only completed sessions qualify.",
        )

    if is_uncertain:
        return QualificationResult(
            qualifies=False,
            points=0,
            reason_code="UNCERTAIN_EVIDENCE",
            explanation="Session technique evidence was uncertain or unverified.",
        )

    if technique_score < min_qualifying_score:
        return QualificationResult(
            qualifies=False,
            points=0,
            reason_code="INSUFFICIENT_SCORE",
            explanation=(
                f"Technique score {technique_score:.1f} is below qualifying "
                f"threshold {min_qualifying_score:.1f}."
            ),
        )

    if daily_count_today >= daily_cap:
        return QualificationResult(
            qualifies=False,
            points=0,
            reason_code="DAILY_CAP_EXCEEDED",
            explanation=f"Daily qualifying limit of {daily_cap} reached for this date.",
        )

    # Award points: 10 base points, +5 bonus for excellent technique (>= 90.0)
    if technique_score >= 90.0:
        return QualificationResult(
            qualifies=True,
            points=15,
            reason_code="VALIDATED_COMPLETION_WITH_BONUS",
            explanation=f"Awarded 10 base points + 5 excellence bonus ({technique_score:.1f}% technique).",
        )

    return QualificationResult(
        qualifies=True,
        points=10,
        reason_code="VALIDATED_COMPLETION",
        explanation=f"Awarded 10 points for validated protocol completion ({technique_score:.1f}% technique).",
    )


def count_student_qualifying_rewards_on_date(
    conn: sqlite3.Connection,
    student_id: str,
    target_local_date: str,
    school_timezone: str = "UTC",
) -> int:
    """Count how many positive qualifying reward transactions the student received on a local date."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT COALESCE(s.started_at, r.created_at) AS event_date
        FROM reward_transactions r
        LEFT JOIN sessions s ON r.session_id = s.session_id
        WHERE r.student_id = ? AND r.points_delta > 0;
        """,
        (student_id,),
    )
    rows = cursor.fetchall()
    count = 0
    for row in rows:
        event_date_str = row["event_date"]
        row_local_date = compute_local_date_str(event_date_str, school_timezone)
        if row_local_date == target_local_date:
            count += 1
    return count


def process_session_reward(
    conn: sqlite3.Connection,
    session_id: str,
    technique_score: float,
    is_uncertain: bool = False,
    school_timezone: str | None = None,
    daily_cap: int | None = None,
) -> dict[str, Any]:
    """Issue reward points for a session atomically within a single database transaction.

    Invariants:
    1. Idempotency: Duplicate calls with the same session_id return the existing transaction.
    2. Atomic persistence: Marks qualifies_for_points in sessions and creates reward_transaction
       inside the same transaction.
    3. Daily cap enforced using school timezone.
    4. Unassigned or non-qualifying sessions earn 0 points.
    """
    idempotency_key = f"reward:session:{session_id}"

    # Check for existing transaction (idempotent lookup)
    existing = RewardTransactionsRepository.get_by_idempotency_key(
        conn, idempotency_key
    )
    if existing:
        return {
            "status": "already_processed",
            "qualifies": True,
            "reward_transaction": existing,
            "points_awarded": existing["points_delta"],
            "reason_code": existing["reason_code"],
        }

    # Retrieve session
    session = SessionsRepository.get_by_id(conn, session_id)
    if not session:
        raise SessionNotFoundError(f"Session '{session_id}' not found.")

    # Resolve settings
    tz = school_timezone or SettingsRepository.get(conn, "school_timezone", "UTC")
    cap = (
        daily_cap
        if daily_cap is not None
        else int(SettingsRepository.get(conn, "daily_reward_cap", "3"))
    )

    student_id = session.get("student_id")
    started_at = session.get("started_at") or datetime.now(UTC).isoformat()
    session_local_date = compute_local_date_str(started_at, tz)

    # Check student daily count
    daily_count = 0
    if student_id:
        daily_count = count_student_qualifying_rewards_on_date(
            conn, student_id, session_local_date, tz
        )

    qualification = evaluate_qualification(
        session_data=session,
        technique_score=technique_score,
        is_uncertain=is_uncertain,
        daily_count_today=daily_count,
        daily_cap=cap,
    )

    # Single atomic transaction
    with transaction(conn) as tx:
        cursor = tx.cursor()
        now_iso = datetime.now(UTC).isoformat()

        if qualification.qualifies and student_id:
            # Mark session as qualifying
            cursor.execute(
                """
                UPDATE sessions
                SET qualifies_for_points = 1,
                    ended_at = COALESCE(ended_at, ?)
                WHERE session_id = ?;
                """,
                (now_iso, session_id),
            )

            # Insert immutable reward transaction
            reward_record = RewardTransactionsRepository.create(
                tx,
                student_id=student_id,
                session_id=session_id,
                points_delta=qualification.points,
                reason_code=qualification.reason_code,
                idempotency_key=idempotency_key,
                notes=qualification.explanation,
            )

            return {
                "status": "awarded",
                "qualifies": True,
                "reward_transaction": reward_record,
                "points_awarded": qualification.points,
                "reason_code": qualification.reason_code,
                "period_key": compute_period_key(started_at, tz),
            }
        else:
            # Mark session as non-qualifying
            cursor.execute(
                """
                UPDATE sessions
                SET qualifies_for_points = 0,
                    failure_reason = ?
                WHERE session_id = ?;
                """,
                (qualification.reason_code, session_id),
            )

            return {
                "status": "not_qualifying",
                "qualifies": False,
                "reward_transaction": None,
                "points_awarded": 0,
                "reason_code": qualification.reason_code,
                "explanation": qualification.explanation,
            }


def reverse_session_reward(
    conn: sqlite3.Connection,
    session_id: str,
    teacher_id: str | None = None,
    reason: str = "TEACHER_REVERSAL",
    notes: str | None = None,
) -> dict[str, Any]:
    """Reverse an issued session reward using an immutable compensating transaction.

    Invariants:
    1. Historical transactions are never deleted or modified.
    2. Inserts a compensating row with negative points_delta.
    3. Updates qualifies_for_points to 0 on the source session.
    4. Idempotent: multiple calls for the same reversal return existing record.
    """
    reversal_key = f"reversal:session:{session_id}"

    # Check if already reversed
    existing_reversal = RewardTransactionsRepository.get_by_idempotency_key(
        conn, reversal_key
    )
    if existing_reversal:
        return {
            "status": "already_reversed",
            "compensating_transaction": existing_reversal,
            "points_reversed": existing_reversal["points_delta"],
        }

    # Find original qualifying award
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT * FROM reward_transactions
        WHERE session_id = ? AND points_delta > 0
        ORDER BY created_at DESC LIMIT 1;
        """,
        (session_id,),
    )
    row = cursor.fetchone()
    if not row:
        raise RewardNotFoundError(
            f"No qualifying reward transaction found for session '{session_id}' to reverse."
        )

    original_tx = dict(row)
    points_to_reverse = -original_tx["points_delta"]
    student_id = original_tx["student_id"]

    with transaction(conn) as tx:
        # 1. Insert compensating transaction
        compensating_tx = RewardTransactionsRepository.create(
            tx,
            student_id=student_id,
            session_id=session_id,
            points_delta=points_to_reverse,
            reason_code="REVERSAL",
            idempotency_key=reversal_key,
            created_by_teacher_id=teacher_id,
            notes=notes
            or f"Compensating reversal for {original_tx['transaction_id']}: {reason}",
        )

        # 2. Update session record
        tx.cursor().execute(
            """
            UPDATE sessions
            SET qualifies_for_points = 0,
                failure_reason = ?
            WHERE session_id = ?;
            """,
            (f"REVERSED: {reason}", session_id),
        )

    return {
        "status": "reversed",
        "compensating_transaction": compensating_tx,
        "points_reversed": points_to_reverse,
        "original_transaction_id": original_tx["transaction_id"],
    }
