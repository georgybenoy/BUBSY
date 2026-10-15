"""Comprehensive tests for Bubsy SQLite schema, migrations, constraints, and data-access layer."""

import os
import sqlite3
import tempfile
import uuid

import pytest
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories import (
    AchievementsRepository,
    AuditEventsRepository,
    ClassesRepository,
    CredentialsRepository,
    RewardTransactionsRepository,
    SessionsRepository,
    SessionStepsRepository,
    SettingsRepository,
    StudentAchievementsRepository,
    StudentsRepository,
    TeachersRepository,
)


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database file for isolation and remove upon teardown."""
    fd, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(fd)
    run_migrations(path)
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_migrations_repeatable_and_safe(temp_db):
    """Verify migrations create schema reliably and running twice is safe and idempotent."""
    # Second run should apply 0 migrations and not error
    reapplied = run_migrations(temp_db)
    assert reapplied == []

    conn = create_connection(temp_db)
    cursor = conn.cursor()

    # Verify migration record
    cursor.execute("SELECT version, name FROM schema_migrations;")
    migrations = cursor.fetchall()
    assert len(migrations) == 1
    assert migrations[0]["version"] == 1
    assert migrations[0]["name"] == "initial"

    # Verify all 11 business tables exist
    expected_tables = {
        "classes",
        "students",
        "credentials",
        "sessions",
        "session_steps",
        "teachers",
        "reward_transactions",
        "achievements",
        "student_achievements",
        "settings",
        "audit_events",
        "schema_migrations",
    }
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    existing_tables = {row[0] for row in cursor.fetchall()}
    assert expected_tables.issubset(existing_tables)
    conn.close()


def test_foreign_keys_are_enforced(temp_db):
    """Verify that foreign key constraints are enforced on connections."""
    conn = create_connection(temp_db)

    # 1. Inserting a student with a non-existent class must fail
    with pytest.raises(sqlite3.IntegrityError):
        StudentsRepository.create(
            conn,
            display_name="Test Student",
            class_id="non-existent-class-id",
        )

    # 2. Inserting a credential with a non-existent student must fail
    with pytest.raises(sqlite3.IntegrityError):
        CredentialsRepository.create(
            conn,
            student_id="non-existent-student-id",
            credential_type="QR",
            credential_hash="hash-12345",
        )

    # 3. Restrict check: deleting a class that has students must fail
    cls = ClassesRepository.create(conn, name="Class 1A", academic_year="2026-2027")
    std = StudentsRepository.create(conn, display_name="Leo", class_id=cls["class_id"])
    assert std is not None

    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("DELETE FROM classes WHERE class_id = ?;", (cls["class_id"],))

    conn.close()


def test_unique_constraints_rejected(temp_db):
    """Verify unique constraints on credential_hash and reward idempotency_key."""
    conn = create_connection(temp_db)
    cls = ClassesRepository.create(conn, name="Class 2A", academic_year="2026-2027")
    std = StudentsRepository.create(conn, display_name="Maya", class_id=cls["class_id"])

    # Duplicate credential_hash must raise IntegrityError
    CredentialsRepository.create(
        conn,
        student_id=std["student_id"],
        credential_type="QR",
        credential_hash="unique_hash_abc_123",
    )
    with pytest.raises(sqlite3.IntegrityError):
        CredentialsRepository.create(
            conn,
            student_id=std["student_id"],
            credential_type="QR",
            credential_hash="unique_hash_abc_123",
        )

    # Duplicate reward transaction idempotency_key must raise IntegrityError
    RewardTransactionsRepository.create(
        conn,
        student_id=std["student_id"],
        points_delta=10,
        reason_code="QUALIFIED_SESSION",
        idempotency_key="idemp_key_xyz_789",
    )
    with pytest.raises(sqlite3.IntegrityError):
        RewardTransactionsRepository.create(
            conn,
            student_id=std["student_id"],
            points_delta=10,
            reason_code="QUALIFIED_SESSION",
            idempotency_key="idemp_key_xyz_789",
        )

    conn.close()


def test_transaction_rolls_back_on_failure(temp_db):
    """Verify that a transaction rolls back all pending changes if a statement fails."""
    unique_class_name = f"Rollback_Class_{uuid.uuid4().hex[:8]}"

    with (
        pytest.raises(RuntimeError),
        transaction(db_path=temp_db) as conn,
    ):
        ClassesRepository.create(
            conn, name=unique_class_name, academic_year="2026-2027"
        )
        # Force an intentional failure
        raise RuntimeError("Simulated mid-transaction failure")

    # Verify the class was NOT committed
    conn = create_connection(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM classes WHERE name = ?;", (unique_class_name,))
    row = cursor.fetchone()
    assert row is None
    conn.close()


def test_check_constraints_enforced(temp_db):
    """Verify CHECK constraints for credential_type, outcome, step result, and teacher role."""
    conn = create_connection(temp_db)
    cls = ClassesRepository.create(conn, name="Class 3A", academic_year="2026-2027")
    std = StudentsRepository.create(conn, display_name="Noah", class_id=cls["class_id"])

    # Invalid credential_type (only 'QR' or 'NFC' allowed)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO credentials (credential_id, student_id, credential_type, credential_hash, is_active, created_at) "
            "VALUES ('c1', ?, 'BIOMETRIC_FACE', 'hash99', 1, '2026-10-13T00:00:00Z');",
            (std["student_id"],),
        )

    # Invalid session outcome (must be completed, incomplete, uncertain, cancelled, error)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO sessions (session_id, student_id, kiosk_id, started_at, outcome, protocol_version, created_at) "
            "VALUES ('s1', ?, 'kiosk-1', '2026-10-13T00:00:00Z', 'super_clean', '1.0', '2026-10-13T00:00:00Z');",
            (std["student_id"],),
        )

    # Valid session for step testing
    sess = SessionsRepository.create(
        conn, kiosk_id="kiosk-1", protocol_version="1.0", outcome="incomplete"
    )

    # Invalid step result (must be recognized, retry, uncertain, skipped)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO session_steps (session_step_id, session_id, step_code, sequence_index, result, created_at) "
            "VALUES ('step1', ?, 'palm_to_palm', 1, 'germs_killed', '2026-10-13T00:00:00Z');",
            (sess["session_id"],),
        )

    # Invalid teacher role (must be admin, teacher, operator)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO teachers (teacher_id, username, password_hash, role, created_at) "
            "VALUES ('t1', 'bad_user', 'hash', 'super_root', '2026-10-13T00:00:00Z');"
        )

    conn.close()


def test_no_image_or_video_or_biometric_columns(temp_db):
    """CRITICAL PRIVACY TEST: Verify no table has any image, video, photo, face, or path column."""
    conn = create_connection(temp_db)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence';"
    )
    tables = [row[0] for row in cursor.fetchall()]

    prohibited_substrings = [
        "image",
        "photo",
        "video",
        "frame",
        "face",
        "facial",
        "embedding",
        "biometric",
        "camera",
        "picture",
        "path",
        "url",
        "jpg",
        "jpeg",
        "png",
        "mp4",
        "avi",
        # Sensitive student details prohibited by DATABASE.md Section 4.2
        "birth",
        "dob",
        "address",
        "parent",
        "phone",
        "email",
    ]

    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = cursor.fetchall()
        for col in columns:
            col_name = col["name"].lower()
            for bad_term in prohibited_substrings:
                assert bad_term not in col_name, (
                    f"Privacy / Spec violation: Table '{table}' contains prohibited column '{col['name']}' "
                    f"matching term '{bad_term}'."
                )

    conn.close()


def test_all_indexes_exist(temp_db):
    """Verify all 6 performance indexes specified in DATABASE.md section 5 are created."""
    conn = create_connection(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index';")
    existing_indexes = {row[0] for row in cursor.fetchall()}

    expected_indexes = {
        "idx_students_class_id",
        "idx_sessions_student_id",
        "idx_sessions_started_at",
        "idx_sessions_outcome",
        "idx_session_steps_session_id",
        "idx_reward_transactions_student_id",
    }

    assert expected_indexes.issubset(existing_indexes)
    conn.close()


def test_repositories_crud(temp_db):
    """Verify CRUD methods of all repositories operate cleanly with parameterized queries."""
    conn = create_connection(temp_db)

    # 1. Classes
    cls = ClassesRepository.create(
        conn, name="Grade 5A", academic_year="2026-2027", grade="5"
    )
    assert ClassesRepository.get_by_id(conn, cls["class_id"])["name"] == "Grade 5A"

    # 2. Students
    std = StudentsRepository.create(
        conn, display_name="Aria", class_id=cls["class_id"], school_student_code="S501"
    )
    assert StudentsRepository.get_by_school_code(conn, "S501")["display_name"] == "Aria"

    # 3. Credentials
    cred = CredentialsRepository.create(
        conn,
        student_id=std["student_id"],
        credential_type="QR",
        credential_hash="cred_hash_501",
    )
    assert (
        CredentialsRepository.get_by_hash(conn, "cred_hash_501")["student_id"]
        == std["student_id"]
    )
    assert CredentialsRepository.revoke(conn, cred["credential_id"]) is True

    # 4. Sessions & Steps
    sess = SessionsRepository.create(
        conn,
        kiosk_id="kiosk-alpha",
        protocol_version="1.0.0",
        student_id=std["student_id"],
    )
    SessionStepsRepository.record_step(
        conn,
        session_id=sess["session_id"],
        step_code="palm_to_palm",
        sequence_index=1,
        result="recognized",
        duration_ms=5200,
        confidence_summary=0.94,
    )
    steps = SessionStepsRepository.list_by_session(conn, sess["session_id"])
    assert len(steps) == 1
    assert steps[0]["step_code"] == "palm_to_palm"
    assert steps[0]["confidence_summary"] == 0.94

    SessionsRepository.finalize_session(
        conn,
        session_id=sess["session_id"],
        ended_at="2026-10-13T20:00:30Z",
        duration_seconds=30,
        outcome="completed",
        qualifies_for_points=1,
    )
    final_sess = SessionsRepository.get_by_id(conn, sess["session_id"])
    assert final_sess["outcome"] == "completed"
    assert final_sess["qualifies_for_points"] == 1

    # 5. Reward Transactions
    RewardTransactionsRepository.create(
        conn,
        student_id=std["student_id"],
        session_id=sess["session_id"],
        points_delta=10,
        reason_code="VALIDATED_SESSION",
        idempotency_key=f"idemp_{sess['session_id']}",
    )
    total_pts = RewardTransactionsRepository.get_student_points_summary(
        conn, std["student_id"]
    )
    assert total_pts == 10

    # 6. Achievements & Student Achievements
    ach = AchievementsRepository.create(
        conn, name="First Wash", description="First qualifying wash", criteria_json="{}"
    )
    StudentAchievementsRepository.award_badge(
        conn,
        student_id=std["student_id"],
        achievement_id=ach["achievement_id"],
        source_key="badge_first_wash",
    )
    badges = StudentAchievementsRepository.list_by_student(conn, std["student_id"])
    assert len(badges) == 1
    assert badges[0]["name"] == "First Wash"

    # 7. Teachers
    teacher = TeachersRepository.create(
        conn, username="mrs_smith", password_hash="hash_sec", role="teacher"
    )
    assert TeachersRepository.get_by_username(conn, "mrs_smith")["role"] == "teacher"
    assert TeachersRepository.update_last_login(conn, teacher["teacher_id"]) is True

    # 8. Settings
    SettingsRepository.set(conn, "school_timezone", "Asia/Kolkata")
    assert SettingsRepository.get(conn, "school_timezone") == "Asia/Kolkata"

    # 9. Audit Events
    AuditEventsRepository.log(
        conn,
        action="UPDATE_SETTING",
        entity_type="SETTING",
        entity_id="school_timezone",
        teacher_id=teacher["teacher_id"],
    )
    events = AuditEventsRepository.list_events(conn)
    assert len(events) >= 1
    assert events[0]["action"] == "UPDATE_SETTING"

    conn.close()
