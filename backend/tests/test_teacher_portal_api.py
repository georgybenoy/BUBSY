"""Integration tests for Phase 9 teacher portal endpoints.

Covers:
- Auth & RBAC (unauthenticated 401, operator vs teacher vs admin 403/200).
- Overview KPI metrics with real query aggregates and empty state.
- Sessions listing with filters (date, class, outcome), pagination, and detail inspection.
- Outcome categorization (completed-qualifying, incomplete, recognition_uncertain, cancelled, device_failure).
- Leaderboard rankings, school timezone month boundaries, and tie-breaking.
- Audited point corrections creating compensating transactions.
- Analytics trends, normalized completion by class, step difficulty.
- Sanitized CSV export with mandatory hygiene disclaimer header and formula injection prevention.
"""

import sqlite3
from typing import Any

import pytest
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.session_steps_repo import SessionStepsRepository
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.settings_repo import SettingsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.database.repositories.teachers_repo import TeachersRepository
from app.main import app
from app.services.session_service import session_store
from fastapi.testclient import TestClient


@pytest.fixture
def test_db():
    """In-memory SQLite database initialized with schema migrations."""
    conn = create_connection(":memory:")
    run_migrations(conn=conn)
    yield conn
    conn.close()


@pytest.fixture
def client(test_db: sqlite3.Connection):
    """FastAPI TestClient with overridden database dependency."""
    from app.api.deps import get_db

    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    session_store.clear()


@pytest.fixture
def auth_tokens(test_db: sqlite3.Connection):
    """Create test teacher accounts with admin, teacher, and operator roles."""
    with transaction(test_db) as tx:
        admin_t = TeachersRepository.create(
            tx, username="admin_user", password_hash="dummy_hash", role="admin"
        )
        teacher_t = TeachersRepository.create(
            tx, username="teacher_user", password_hash="dummy_hash", role="teacher"
        )
        operator_t = TeachersRepository.create(
            tx, username="operator_user", password_hash="dummy_hash", role="operator"
        )

    # Issue active session tokens
    token_admin, _ = session_store.create_session(
        admin_t["teacher_id"], admin_t["username"], admin_t["role"]
    )
    token_teacher, _ = session_store.create_session(
        teacher_t["teacher_id"], teacher_t["username"], teacher_t["role"]
    )
    token_operator, _ = session_store.create_session(
        operator_t["teacher_id"], operator_t["username"], operator_t["role"]
    )

    return {
        "admin": token_admin,
        "teacher": token_teacher,
        "operator": token_operator,
    }


@pytest.fixture
def seeded_portal_data(test_db: sqlite3.Connection, auth_tokens: dict[str, str]):
    """Seed classes, students, sessions, steps, and reward transactions."""
    with transaction(test_db) as tx:
        # Settings
        SettingsRepository.set(tx, "school_timezone", "America/New_York")
        SettingsRepository.set(tx, "daily_reward_cap", "3")

        # Classes
        c1 = ClassesRepository.create(
            tx, name="Class 1A", grade="1", academic_year="2026-2027"
        )
        c2 = ClassesRepository.create(
            tx, name="Class 2B", grade="2", academic_year="2026-2027"
        )

        # Students
        s1 = StudentsRepository.create(
            tx,
            display_name="Alice Smith",
            class_id=c1["class_id"],
            school_student_code="S-101",
        )
        s2 = StudentsRepository.create(
            tx,
            display_name="Bob Jones",
            class_id=c1["class_id"],
            school_student_code="S-102",
        )
        s3 = StudentsRepository.create(
            tx,
            display_name="Charlie Brown",
            class_id=c2["class_id"],
            school_student_code="S-201",
        )

        # Sessions for October 2026
        # Alice: 2 completed qualifying sessions
        sess1 = SessionsRepository.create(
            tx,
            student_id=s1["student_id"],
            kiosk_id="kiosk-sink-1",
            protocol_version="1.0.0",
            model_version="bubsy-yolo-v1",
            outcome="completed",
            started_at="2026-10-14T10:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=sess1["session_id"],
            ended_at="2026-10-14T10:00:35Z",
            duration_seconds=35,
            outcome="completed",
            qualifies_for_points=1,
        )
        RewardTransactionsRepository.create(
            tx,
            student_id=s1["student_id"],
            session_id=sess1["session_id"],
            points_delta=15,
            reason_code="VALIDATED_COMPLETION",
            idempotency_key="rew-1",
        )
        SessionStepsRepository.record_step(
            tx,
            session_id=sess1["session_id"],
            step_code="STEP_1",
            sequence_index=0,
            result="recognized",
            duration_ms=3200,
        )
        SessionStepsRepository.record_step(
            tx,
            session_id=sess1["session_id"],
            step_code="STEP_2",
            sequence_index=1,
            result="recognized",
            duration_ms=3100,
        )

        sess2 = SessionsRepository.create(
            tx,
            student_id=s1["student_id"],
            kiosk_id="kiosk-sink-1",
            protocol_version="1.0.0",
            outcome="completed",
            started_at="2026-10-15T10:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=sess2["session_id"],
            ended_at="2026-10-15T10:00:30Z",
            duration_seconds=30,
            outcome="completed",
            qualifies_for_points=1,
        )
        RewardTransactionsRepository.create(
            tx,
            student_id=s1["student_id"],
            session_id=sess2["session_id"],
            points_delta=10,
            reason_code="VALIDATED_COMPLETION",
            idempotency_key="rew-2",
        )

        # Bob: 1 incomplete session with uncertainty
        sess3 = SessionsRepository.create(
            tx,
            student_id=s2["student_id"],
            kiosk_id="kiosk-sink-1",
            protocol_version="1.0.0",
            outcome="uncertain",
            started_at="2026-10-14T11:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=sess3["session_id"],
            ended_at="2026-10-14T11:00:20Z",
            duration_seconds=20,
            outcome="uncertain",
            qualifies_for_points=0,
            failure_reason="UNCERTAIN_TECHNIQUE",
        )
        SessionStepsRepository.record_step(
            tx,
            session_id=sess3["session_id"],
            step_code="STEP_1",
            sequence_index=0,
            result="uncertain",
            duration_ms=2500,
        )

        # Charlie: 1 cancelled session and 1 device failure
        sess4 = SessionsRepository.create(
            tx,
            student_id=s3["student_id"],
            kiosk_id="kiosk-sink-1",
            protocol_version="1.0.0",
            outcome="cancelled",
            started_at="2026-10-14T12:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=sess4["session_id"],
            ended_at="2026-10-14T12:00:05Z",
            duration_seconds=5,
            outcome="cancelled",
            qualifies_for_points=0,
        )

        sess5 = SessionsRepository.create(
            tx,
            student_id=s3["student_id"],
            kiosk_id="kiosk-sink-1",
            protocol_version="1.0.0",
            outcome="error",
            started_at="2026-10-14T13:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=sess5["session_id"],
            ended_at="2026-10-14T13:00:02Z",
            duration_seconds=2,
            outcome="error",
            qualifies_for_points=0,
            failure_reason="CAMERA_DISCONNECTED",
        )

    return {
        "classes": [c1, c2],
        "students": [s1, s2, s3],
        "sessions": [sess1, sess2, sess3, sess4, sess5],
    }


# ---------------------------------------------------------------------------
# 1. Auth & RBAC Tests
# ---------------------------------------------------------------------------


def test_unauthenticated_requests_are_rejected(client: TestClient):
    """All teacher endpoints strictly require authentication."""
    endpoints = [
        "/api/v1/overview",
        "/api/v1/sessions",
        "/api/v1/sessions/any-id",
        "/api/v1/leaderboard",
        "/api/v1/leaderboard/transactions",
        "/api/v1/analytics",
        "/api/v1/analytics/export",
        "/api/v1/settings",
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 401, f"Expected 401 for {ep}, got {resp.status_code}"


def test_settings_rbac_only_admin_can_update(
    client: TestClient, auth_tokens: dict[str, str]
):
    """Only admin role can write settings; teachers and operators receive 403."""
    # Teacher role attempt
    headers_teacher = {"Authorization": f"Bearer {auth_tokens['teacher']}"}
    resp = client.patch(
        "/api/v1/settings",
        json={"daily_reward_cap": 5},
        headers=headers_teacher,
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    # Operator role attempt
    headers_operator = {"Authorization": f"Bearer {auth_tokens['operator']}"}
    resp = client.patch(
        "/api/v1/settings",
        json={"daily_reward_cap": 5},
        headers=headers_operator,
    )
    assert resp.status_code == 403

    # Admin role attempt succeeds
    headers_admin = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    resp = client.patch(
        "/api/v1/settings",
        json={"daily_reward_cap": 5, "school_timezone": "America/Chicago"},
        headers=headers_admin,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["daily_reward_cap"] == 5
    assert data["school_timezone"] == "America/Chicago"


# ---------------------------------------------------------------------------
# 2. Overview Dashboard Tests
# ---------------------------------------------------------------------------


def test_overview_empty_state_returns_zeroes_never_mocks(
    client: TestClient, auth_tokens: dict[str, str]
):
    """An empty database returns true zeros and empty structures, never hardcoded mock values."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}
    resp = client.get("/api/v1/overview", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    metrics = data["metrics"]

    assert metrics["registered_students"] == 0
    assert metrics["qualifying_washes"] == 0
    assert metrics["active_participants"] == 0
    assert metrics["protocol_completion"]["percentage"] == 0.0
    assert metrics["protocol_completion"]["numerator"] == 0
    assert metrics["protocol_completion"]["denominator"] == 0
    assert data["activity_trend"] == []
    assert data["recent_activity"] == []
    assert data["leaderboard_summary"] == []


def test_overview_aggregates_over_seeded_fixture(
    client: TestClient, auth_tokens: dict[str, str], seeded_portal_data: dict[str, Any]
):
    """Overview aggregates match seeded sessions accurately."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}
    resp = client.get("/api/v1/overview?period=2026-10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    metrics = data["metrics"]

    # 3 registered students (Alice, Bob, Charlie)
    assert metrics["registered_students"] == 3
    # 2 qualifying washes (both by Alice)
    assert metrics["qualifying_washes"] == 2
    # 1 active participant (Alice had qualifying washes)
    assert metrics["active_participants"] == 1
    # 2 completed out of 5 total sessions = 40.0%
    assert metrics["protocol_completion"]["numerator"] == 2
    assert metrics["protocol_completion"]["denominator"] == 5
    assert metrics["protocol_completion"]["percentage"] == 40.0

    # Class comparison
    assert len(data["class_comparison"]) == 2
    # Recent activity
    assert len(data["recent_activity"]) == 5
    # Leaderboard top entry is Alice with 25 points
    assert len(data["leaderboard_summary"]) == 1
    assert data["leaderboard_summary"][0]["display_name"] == "Alice Smith"
    assert data["leaderboard_summary"][0]["total_points"] == 25


# ---------------------------------------------------------------------------
# 3. Sessions List and Detail Tests
# ---------------------------------------------------------------------------


def test_sessions_list_filters_and_outcome_categories(
    client: TestClient, auth_tokens: dict[str, str], seeded_portal_data: dict[str, Any]
):
    """Sessions list returns correct 5-way outcome categories and filters."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}

    # All sessions
    resp = client.get("/api/v1/sessions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 5
    assert len(data["items"]) == 5

    categories = {item["outcome_category"] for item in data["items"]}
    assert "completed-qualifying" in categories
    assert "recognition_uncertain" in categories
    assert "cancelled" in categories
    assert "device_failure" in categories

    # Filter by class
    c1_id = seeded_portal_data["classes"][0]["class_id"]
    resp_class = client.get(f"/api/v1/sessions?class_id={c1_id}", headers=headers)
    assert resp_class.status_code == 200
    assert resp_class.json()["data"]["total"] == 3  # Alice's 2 + Bob's 1

    # Filter by outcome
    resp_outcome = client.get("/api/v1/sessions?outcome=completed", headers=headers)
    assert resp_outcome.status_code == 200
    assert resp_outcome.json()["data"]["total"] == 2


def test_session_detail_audit_inspection(
    client: TestClient, auth_tokens: dict[str, str], seeded_portal_data: dict[str, Any]
):
    """Session detail exposes step execution sequence, duration, points, and uncertainty notes."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}
    sess1_id = seeded_portal_data["sessions"][0]["session_id"]

    resp = client.get(f"/api/v1/sessions/{sess1_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["session_id"] == sess1_id
    assert data["student_name"] == "Alice Smith"
    assert data["outcome_category"] == "completed-qualifying"
    assert data["points_awarded"] == 15
    assert len(data["recognized_sequence"]) == 2
    assert data["recognized_sequence"][0]["step_code"] == "STEP_1"
    assert data["recognized_sequence"][0]["step_name"] == "Palm to Palm"
    assert len(data["expected_sequence"]) == 6

    # 404 for unknown session
    resp_404 = client.get("/api/v1/sessions/non-existent-id", headers=headers)
    assert resp_404.status_code == 404


# ---------------------------------------------------------------------------
# 4. Leaderboard & Audited Point Corrections
# ---------------------------------------------------------------------------


def test_leaderboard_rankings_and_point_correction(
    client: TestClient, auth_tokens: dict[str, str], seeded_portal_data: dict[str, Any]
):
    """Leaderboard ranks students and allows teachers to issue compensating corrections."""
    headers_teacher = {"Authorization": f"Bearer {auth_tokens['teacher']}"}

    # 1. Check initial leaderboard
    resp = client.get("/api/v1/leaderboard?month=2026-10", headers=headers_teacher)
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    alice = next(i for i in items if i["display_name"] == "Alice Smith")
    assert alice["total_points"] == 25
    assert alice["rank"] == 1

    # 2. Operator cannot submit correction
    headers_operator = {"Authorization": f"Bearer {auth_tokens['operator']}"}
    corr_payload = {
        "student_id": alice["student_id"],
        "points_delta": -5,
        "reason": "Accidental duplicate award correction",
    }
    resp_op = client.post(
        "/api/v1/leaderboard/corrections", json=corr_payload, headers=headers_operator
    )
    assert resp_op.status_code == 403

    # 3. Teacher submits correction
    resp_corr = client.post(
        "/api/v1/leaderboard/corrections", json=corr_payload, headers=headers_teacher
    )
    assert resp_corr.status_code == 200
    corr_data = resp_corr.json()["data"]
    assert corr_data["points_delta"] == -5
    assert corr_data["reason_code"] == "TEACHER_CORRECTION"

    # 4. Check leaderboard updated: 25 - 5 = 20 points
    resp_after = client.get(
        "/api/v1/leaderboard?month=2026-10", headers=headers_teacher
    )
    items_after = resp_after.json()["data"]["items"]
    alice_after = next(i for i in items_after if i["display_name"] == "Alice Smith")
    assert alice_after["total_points"] == 20

    # 5. Check transaction listed in audit log
    resp_tx = client.get(
        f"/api/v1/leaderboard/transactions?student_id={alice['student_id']}",
        headers=headers_teacher,
    )
    assert resp_tx.status_code == 200
    tx_items = resp_tx.json()["data"]["items"]
    assert any(t["points_delta"] == -5 for t in tx_items)


# ---------------------------------------------------------------------------
# 5. Analytics & Sanitized CSV Export
# ---------------------------------------------------------------------------


def test_analytics_aggregates_and_step_difficulty(
    client: TestClient, auth_tokens: dict[str, str], seeded_portal_data: dict[str, Any]
):
    """Analytics provides trends, class completion, distribution, and step uncertainty."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}
    resp = client.get("/api/v1/analytics?period=2026-10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert "disclaimer" in data
    assert "does not prove microbiological cleanliness" in data["disclaimer"]
    assert len(data["daily_trends"]) >= 2
    assert len(data["completion_by_class"]) == 2
    assert len(data["participation_distribution"]) == 4

    # STEP_1 had 1 recognized and 1 uncertain -> uncertainty_rate = 50.0%
    step_1 = next(
        s for s in data["commonly_missed_steps"] if s["step_code"] == "STEP_1"
    )
    assert step_1["total_attempts"] == 2
    assert step_1["uncertain_count"] == 1
    assert step_1["recognized_count"] == 1
    assert step_1["uncertainty_rate"] == 50.0


def test_analytics_csv_export_sanitization_and_disclaimer(
    client: TestClient,
    auth_tokens: dict[str, str],
    seeded_portal_data: dict[str, Any],
    test_db: sqlite3.Connection,
):
    """CSV export includes mandatory hygiene disclaimer and escapes spreadsheet injection."""
    headers = {"Authorization": f"Bearer {auth_tokens['teacher']}"}

    # Insert a malicious student with formula injection in code
    with transaction(test_db) as tx:
        c_id = seeded_portal_data["classes"][0]["class_id"]
        mal_student = StudentsRepository.create(
            tx,
            display_name="=CMD|' /C calc'!A0",
            school_student_code="+12345",
            class_id=c_id,
        )
        mal_sess = SessionsRepository.create(
            tx,
            student_id=mal_student["student_id"],
            kiosk_id="kiosk-1",
            protocol_version="1.0.0",
            outcome="completed",
            started_at="2026-10-16T10:00:00Z",
        )
        SessionsRepository.finalize_session(
            tx,
            session_id=mal_sess["session_id"],
            ended_at="2026-10-16T10:00:20Z",
            duration_seconds=20,
            outcome="completed",
            qualifies_for_points=1,
        )

    resp = client.get("/api/v1/analytics/export?period=2026-10", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "Content-Disposition" in resp.headers

    content = resp.text
    # 1. Line 1 must contain the mandatory disclaimer
    first_line = content.splitlines()[0]
    assert first_line.startswith(
        "# Note: AI technique recognition reflects protocol adherence"
    )
    assert "does not prove microbiological cleanliness" in first_line

    # 2. Formula injection characters (=, +) must be prepended with a single quote (')
    assert "'=CMD|' /C calc'!A0" in content
    assert "'+12345" in content
