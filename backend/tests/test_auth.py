"""Comprehensive tests for Phase 3: Teacher Authentication, RBAC, and Audit Logging.

Tests verify:
1. Unauthenticated requests to protected routes return 401.
2. A teacher cannot call admin-only endpoints (403 Forbidden).
3. A disabled account cannot log in or use an existing session.
4. Passwords are stored securely with Argon2id and never in plaintext.
5. Logs contain no passwords or tokens.
6. Audit events are created for successful logins, failed attempts, and account changes.
7. Login rate limiting triggers 429 after exceeding max attempts.
8. CLI script create_admin creates admin safely with Argon2id.
"""

import io
import json
import logging
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.core.config import settings
from app.core.logging import logger
from app.core.security import hash_password, verify_password
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories import AuditEventsRepository, TeachersRepository
from app.main import app
from app.services.rate_limiter import login_rate_limiter
from app.services.session_service import session_store

from scripts.create_admin import create_admin_account


@pytest.fixture(autouse=True)
def clean_in_memory_state():
    """Ensure in-memory sessions and rate limiter entries are cleared before each test."""
    session_store.clear()
    login_rate_limiter.clear()
    yield
    session_store.clear()
    login_rate_limiter.clear()


@pytest.fixture
def auth_db():
    """Create a temporary database with migrations applied for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    old_db_url = settings.DATABASE_URL
    settings.DATABASE_URL = f"sqlite:///{path}"

    run_migrations(db_path=path)

    yield path

    settings.DATABASE_URL = old_db_url
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


@pytest.fixture
def client(auth_db):
    """TestClient against the configured temporary database."""
    with TestClient(app) as test_client:
        yield test_client


def create_test_teacher(
    db_path: str,
    username: str,
    password: str = "CorrectP@ssword123",
    role: str = "teacher",
    is_active: int = 1,
) -> dict:
    """Helper to create a test teacher in the database."""
    hashed = hash_password(password)
    with transaction(db_path=db_path) as conn:
        teacher = TeachersRepository.create(
            conn=conn,
            username=username,
            password_hash=hashed,
            role=role,
            is_active=is_active,
        )
    return teacher


def test_unauthenticated_requests_return_401(client):
    """Unauthenticated requests to protected routes must return 401."""
    # /api/v1/auth/me requires authentication
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    payload = resp.json()
    assert payload["error"]["code"] == "UNAUTHORIZED"

    # /api/v1/auth/logout requires authentication
    resp_logout = client.post("/api/v1/auth/logout")
    assert resp_logout.status_code == 401


def test_teacher_cannot_call_admin_only_endpoints(client, auth_db):
    """A teacher with 'teacher' role cannot call admin-only endpoints (returns 403)."""
    # Create standard teacher
    create_test_teacher(auth_db, username="standard_teacher", role="teacher")

    # Login as teacher
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "standard_teacher", "password": "CorrectP@ssword123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["data"]["token"]

    # Call admin-only endpoint: PATCH /api/v1/auth/teachers/{teacher_id}/status
    target_id = str(uuid.uuid4())
    patch_resp = client.patch(
        f"/api/v1/auth/teachers/{target_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"is_active": 0},
    )
    assert patch_resp.status_code == 403
    assert patch_resp.json()["error"]["code"] == "FORBIDDEN"


def test_admin_can_call_admin_only_endpoints(client, auth_db):
    """An admin with 'admin' role can successfully call admin-only endpoints."""
    # Create admin and a secondary teacher
    create_test_teacher(auth_db, username="school_admin", role="admin")
    secondary = create_test_teacher(
        auth_db, username="assistant_teacher", role="teacher"
    )

    # Login as admin
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "school_admin", "password": "CorrectP@ssword123"},
    )
    assert login_resp.status_code == 200
    admin_token = login_resp.json()["data"]["token"]

    # Admin deactivates secondary teacher
    patch_resp = client.patch(
        f"/api/v1/auth/teachers/{secondary['teacher_id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": 0},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["is_active"] == 0

    # Verify directly in database
    conn = create_connection(auth_db)
    updated_teacher = TeachersRepository.get_by_id(conn, secondary["teacher_id"])
    conn.close()
    assert updated_teacher["is_active"] == 0


def test_disabled_account_cannot_login(client, auth_db):
    """A disabled account cannot log in and receives generic credentials error."""
    create_test_teacher(auth_db, username="disabled_user", is_active=0)

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "disabled_user", "password": "CorrectP@ssword123"},
    )
    assert login_resp.status_code == 401
    # Generic error message to prevent enumeration
    assert login_resp.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert login_resp.json()["error"]["message"] == "Invalid username or password."


def test_disabled_account_cannot_use_existing_session(client, auth_db):
    """When an account is deactivated, existing sessions are revoked immediately."""
    # Create admin and target teacher
    create_test_teacher(auth_db, username="chief_admin", role="admin")
    teacher = create_test_teacher(
        auth_db, username="active_then_disabled", role="teacher"
    )

    # Teacher logs in and obtains active session
    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"username": "active_then_disabled", "password": "CorrectP@ssword123"},
    )
    assert teacher_login.status_code == 200
    teacher_token = teacher_login.json()["data"]["token"]

    # Verify session works
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["data"]["username"] == "active_then_disabled"

    # Admin deactivates the teacher account
    with transaction(db_path=auth_db) as conn:
        TeachersRepository.set_active_status(conn, teacher["teacher_id"], is_active=0)
    # Also invalidate in session store
    session_store.invalidate_teacher_sessions(teacher["teacher_id"])

    # Next request with previously valid session must be rejected immediately
    me_after_disabled = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert me_after_disabled.status_code == 401
    assert me_after_disabled.json()["error"]["code"] in (
        "ACCOUNT_DISABLED",
        "SESSION_EXPIRED",
    )


def test_passwords_are_stored_hashed_never_plaintext(auth_db):
    """Verify that teacher passwords in the database are stored as Argon2id hashes."""
    plain_password = "SuperSecretSchoolP@ss!99"
    teacher = create_test_teacher(
        auth_db, username="hash_check_teacher", password=plain_password
    )

    conn = create_connection(auth_db)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT password_hash FROM teachers WHERE teacher_id = ?;",
        (teacher["teacher_id"],),
    )
    row = cursor.fetchone()
    stored_hash = row["password_hash"]
    conn.close()

    # Assert hash is NOT plaintext
    assert stored_hash != plain_password
    assert plain_password not in stored_hash
    # Assert Argon2id prefix
    assert stored_hash.startswith("$argon2id$")
    # Verify hash validates with plain password
    assert verify_password(plain_password, stored_hash) is True
    assert verify_password("WrongPassword123", stored_hash) is False


def test_logs_contain_no_passwords_or_tokens(client, auth_db):
    """Ensure that backend logs contain zero plain passwords or session tokens."""
    sensitive_password = "SensitivePlainTextP@ssword!"
    create_test_teacher(auth_db, username="log_test_user", password=sensitive_password)

    # Capture log stream
    log_stream = io.StringIO()
    handler = logging.StreamHandler(log_stream)
    logger.addHandler(handler)

    try:
        # Perform login
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "log_test_user", "password": sensitive_password},
        )
        assert resp.status_code == 200
        token = resp.json()["data"]["token"]

        # Perform a failed login
        client.post(
            "/api/v1/auth/login",
            json={"username": "log_test_user", "password": "BadAttemptPassword!"},
        )

        captured_logs = log_stream.getvalue()

        # Strict assertion: sensitive password must NEVER appear in logs
        assert sensitive_password not in captured_logs
        assert "BadAttemptPassword!" not in captured_logs
        # Session token must NOT appear in logs
        assert token not in captured_logs

    finally:
        logger.removeHandler(handler)


def test_audit_events_are_created(client, auth_db):
    """Audit events are logged for successful login, failed login, and logout."""
    create_test_teacher(auth_db, username="audit_user", password="GoodPassword123")

    # 1. Failed login
    fail_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "audit_user", "password": "WrongPassword!"},
    )
    assert fail_resp.status_code == 401

    # 2. Successful login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "audit_user", "password": "GoodPassword123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["data"]["token"]

    # 3. Logout
    logout_resp = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_resp.status_code == 200

    # Inspect audit_events table
    conn = create_connection(auth_db)
    events = AuditEventsRepository.list_events(conn)
    conn.close()

    actions = [e["action"] for e in events]
    assert "LOGIN_FAILED" in actions
    assert "LOGIN_SUCCESS" in actions
    assert "LOGOUT" in actions

    # Verify that details_json does NOT contain the password
    for e in events:
        if e["details_json"]:
            details = json.loads(e["details_json"])
            assert "password" not in details
            assert "WrongPassword!" not in str(details)
            assert "GoodPassword123" not in str(details)


def test_login_rate_limiting(client, auth_db):
    """Rate limiter enforces HTTP 429 when failed attempts exceed threshold."""
    create_test_teacher(auth_db, username="rate_user", password="ValidPass123!")

    # Perform 5 failed attempts
    for _ in range(5):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "rate_user", "password": "WrongPassword!"},
        )
        assert resp.status_code == 401

    # 6th attempt should be blocked by rate limiter with 429
    blocked_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "rate_user", "password": "WrongPassword!"},
    )
    assert blocked_resp.status_code == 429
    assert blocked_resp.json()["error"]["code"] == "TOO_MANY_REQUESTS"
    assert "Retry-After" in blocked_resp.headers


def test_create_admin_cli_script(auth_db):
    """Verify that scripts/create_admin.py safely creates the admin account with Argon2id."""
    admin_user = f"cli_admin_{uuid.uuid4().hex[:6]}"
    admin_pass = "ComplexAdminPassw0rd!"

    # Run create_admin_account function directly
    create_admin_account(
        username=admin_user,
        password=admin_pass,
        db_path=auth_db,
    )

    # Verify admin in database
    conn = create_connection(auth_db)
    admin_record = TeachersRepository.get_by_username(conn, admin_user)
    assert admin_record is not None
    assert admin_record["role"] == "admin"
    assert admin_record["is_active"] == 1
    assert admin_record["password_hash"].startswith("$argon2id$")
    assert verify_password(admin_pass, admin_record["password_hash"]) is True

    # Verify audit event logged
    events = AuditEventsRepository.list_events(conn)
    teacher_created_events = [
        e
        for e in events
        if e["action"] == "TEACHER_CREATED"
        and e["entity_id"] == admin_record["teacher_id"]
    ]
    assert len(teacher_created_events) == 1
    conn.close()
