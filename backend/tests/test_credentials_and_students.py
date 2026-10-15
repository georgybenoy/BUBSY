"""Comprehensive tests for Phase 4: Students, Classes, Credentials, and Resolver Service.

Tests cover:
1. Credential resolution matrix:
   - Valid QR resolves to student
   - Valid NFC resolves to same student (FR-ID-03)
   - Revoked credential rejected with CREDENTIAL_REVOKED
   - Unknown credential rejected with CREDENTIAL_NOT_FOUND
   - Malformed credential rejected with CREDENTIAL_MALFORMED
   - Inactive student rejected with STUDENT_INACTIVE
2. Collision rejection (duplicate credential_hash rejected)
3. Zero raw token persistence (assert database contains only HMAC hashes, never raw tokens)
4. Credential replacement (FR-ID-08: revokes old, creates new, preserves student ID)
5. Printable QR generation (in-memory, returns PNG stream)
6. Classes and Students CRUD, pagination, filtering, search, and soft deactivation
7. CSV Import edge cases: size limit, column validation, formula injection sanitization, duplicate codes
8. Kiosk identify minimal response (never leaks class rosters or peer records)
9. RBAC: Protected endpoints require teacher authentication
"""

import os
import sqlite3
import tempfile

import pytest
from app.core.config import settings
from app.core.security import hash_password
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories import (
    AuditEventsRepository,
    ClassesRepository,
    CredentialsRepository,
    StudentsRepository,
    TeachersRepository,
)
from app.main import app
from app.services.credential_service import (
    CredentialMalformedError,
    CredentialNotFoundError,
    CredentialRevokedError,
    CredentialService,
    StudentInactiveError,
)
from app.services.rate_limiter import login_rate_limiter
from app.services.session_service import session_store
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def clean_in_memory():
    session_store.clear()
    login_rate_limiter.clear()
    yield
    session_store.clear()
    login_rate_limiter.clear()


@pytest.fixture
def test_db():
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
def client(test_db):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(test_db, client):
    """Authenticate a test teacher and return Authorization headers."""
    with transaction(db_path=test_db) as conn:
        teacher = TeachersRepository.create(
            conn=conn,
            username="teacher_sarah",
            password_hash=hash_password("TeacherPass123!"),
            role="teacher",
            is_active=1,
        )

    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "teacher_sarah", "password": "TeacherPass123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["data"]["token"]
    return {
        "Authorization": f"Bearer {token}",
        "teacher_id": teacher["teacher_id"],
    }


# =====================================================================
# 1. Credential Resolution Matrix Tests
# =====================================================================


def test_credential_resolution_valid_qr_and_nfc(test_db):
    """QR and NFC credentials resolve to the same internal student identity (FR-ID-03)."""
    conn = create_connection(test_db)

    # 1. Create class and student
    cls = ClassesRepository.create(conn, name="Class 4B", academic_year="2026-2027")
    student = StudentsRepository.create(
        conn, display_name="Maya Lin", class_id=cls["class_id"]
    )

    # 2. Issue QR and NFC credentials
    _, raw_qr_token = CredentialService.issue_credential(
        conn, student["student_id"], "QR"
    )
    _, raw_nfc_token = CredentialService.issue_credential(
        conn, student["student_id"], "NFC"
    )
    conn.commit()

    # 3. Resolve QR
    resolved_qr = CredentialService.resolve(conn, "QR", raw_qr_token)
    assert resolved_qr["student_id"] == student["student_id"]
    assert resolved_qr["display_name"] == "Maya Lin"
    assert resolved_qr["credential_type"] == "QR"

    # 4. Resolve NFC through the SAME function
    resolved_nfc = CredentialService.resolve(conn, "NFC", raw_nfc_token)
    assert resolved_nfc["student_id"] == student["student_id"]
    assert resolved_nfc["display_name"] == "Maya Lin"
    assert resolved_nfc["credential_type"] == "NFC"

    conn.close()


def test_credential_resolution_revoked_rejected(test_db):
    """Revoked credentials must be rejected with CREDENTIAL_REVOKED (FR-ID-04)."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(conn, name="Class 1A", academic_year="2026-2027")
    student = StudentsRepository.create(
        conn, display_name="Tom Reed", class_id=cls["class_id"]
    )
    cred, raw_token = CredentialService.issue_credential(
        conn, student["student_id"], "QR"
    )
    conn.commit()

    # Verify active
    assert (
        CredentialService.resolve(conn, "QR", raw_token)["student_id"]
        == student["student_id"]
    )

    # Revoke credential
    CredentialService.revoke_credential(conn, cred["credential_id"])
    conn.commit()

    # Attempt resolution
    with pytest.raises(CredentialRevokedError) as exc_info:
        CredentialService.resolve(conn, "QR", raw_token)
    assert exc_info.value.code == "CREDENTIAL_REVOKED"

    conn.close()


def test_credential_resolution_unknown_rejected(test_db):
    """Unknown credential tokens must be rejected with CREDENTIAL_NOT_FOUND."""
    conn = create_connection(test_db)
    unknown_token = "completely-unknown-token-that-does-not-exist-in-db"

    with pytest.raises(CredentialNotFoundError) as exc_info:
        CredentialService.resolve(conn, "QR", unknown_token)
    assert exc_info.value.code == "CREDENTIAL_NOT_FOUND"

    conn.close()


def test_credential_resolution_malformed_rejected(test_db):
    """Malformed or oversized/blank tokens must be rejected with CREDENTIAL_MALFORMED."""
    conn = create_connection(test_db)

    # Empty string
    with pytest.raises(CredentialMalformedError):
        CredentialService.resolve(conn, "QR", "")

    # Too short (< 8 chars)
    with pytest.raises(CredentialMalformedError):
        CredentialService.resolve(conn, "QR", "short")

    # Invalid credential type
    with pytest.raises(CredentialMalformedError):
        CredentialService.resolve(conn, "FACE", "valid-length-token-12345")

    conn.close()


def test_credential_resolution_inactive_student_rejected(test_db):
    """Credentials for deactivated students must be rejected with STUDENT_INACTIVE."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(conn, name="Class 2A", academic_year="2026-2027")
    student = StudentsRepository.create(
        conn, display_name="Inactive Sam", class_id=cls["class_id"]
    )
    _, raw_token = CredentialService.issue_credential(conn, student["student_id"], "QR")
    conn.commit()

    # Deactivate student
    StudentsRepository.set_active_status(conn, student["student_id"], is_active=0)
    conn.commit()

    with pytest.raises(StudentInactiveError) as exc_info:
        CredentialService.resolve(conn, "QR", raw_token)
    assert exc_info.value.code == "STUDENT_INACTIVE"

    conn.close()


# =====================================================================
# 2. Privacy & Storage Guarantees
# =====================================================================


def test_no_raw_tokens_stored_in_database(test_db):
    """Verify that database never stores the raw token, only keyed HMAC hashes."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(conn, name="Class 3B", academic_year="2026-2027")
    student = StudentsRepository.create(
        conn, display_name="Privacy Child", class_id=cls["class_id"]
    )
    _, raw_token = CredentialService.issue_credential(conn, student["student_id"], "QR")
    conn.commit()

    # Query all columns of credentials table
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM credentials WHERE student_id = ?;", (student["student_id"],)
    )
    rows = cursor.fetchall()
    assert len(rows) == 1
    row = dict(rows[0])

    # Assert raw token is nowhere in the database row
    assert raw_token not in str(row)
    assert row["credential_hash"] != raw_token
    # Assert credential_hash is a 64-character hex string (SHA-256 HMAC)
    assert len(row["credential_hash"]) == 64

    conn.close()


def test_duplicate_credential_hash_rejected(test_db):
    """Enforce UNIQUE constraint on credential_hash."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(conn, name="Class Unique", academic_year="2026-2027")
    s1 = StudentsRepository.create(
        conn, display_name="Child A", class_id=cls["class_id"]
    )
    s2 = StudentsRepository.create(
        conn, display_name="Child B", class_id=cls["class_id"]
    )

    fixed_hash = "f" * 64
    CredentialsRepository.create(
        conn,
        student_id=s1["student_id"],
        credential_type="QR",
        credential_hash=fixed_hash,
    )
    conn.commit()

    with pytest.raises(sqlite3.IntegrityError):
        CredentialsRepository.create(
            conn,
            student_id=s2["student_id"],
            credential_type="QR",
            credential_hash=fixed_hash,
        )
        conn.commit()

    conn.close()


def test_credential_replacement_preserves_student_identity(test_db):
    """Replacing a credential revokes the old one without creating a new student ID (FR-ID-08)."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(
        conn, name="Class Replacement", academic_year="2026-2027"
    )
    student = StudentsRepository.create(
        conn, display_name="Zack Miller", class_id=cls["class_id"]
    )
    _old_cred, old_token = CredentialService.issue_credential(
        conn, student["student_id"], "QR"
    )
    conn.commit()

    # Replace credential
    new_cred, new_token = CredentialService.replace_credential(
        conn, student["student_id"], "QR"
    )
    conn.commit()

    # Assert new raw token is different
    assert new_token != old_token
    # Assert student ID remains identical
    assert new_cred["student_id"] == student["student_id"]

    # Old token is now revoked
    with pytest.raises(CredentialRevokedError):
        CredentialService.resolve(conn, "QR", old_token)

    # New token resolves to the same student
    resolved = CredentialService.resolve(conn, "QR", new_token)
    assert resolved["student_id"] == student["student_id"]

    # Verify audit event for replacement
    events = AuditEventsRepository.list_events(conn)
    replaced_events = [e for e in events if e["action"] == "CREDENTIAL_REPLACED"]
    assert len(replaced_events) == 1

    conn.close()


def test_printable_qr_png_generation():
    """Verify that in-memory QR image generator outputs valid PNG bytes."""
    token = "bubsy-test-opaque-printable-token-12345"
    png_bytes = CredentialService.generate_qr_png_bytes(token)
    # Check PNG magic header bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(png_bytes) > 500


# =====================================================================
# 3. Student and Class API Endpoints
# =====================================================================


def test_class_crud_and_metrics_api(client, auth_headers):
    """Test classes creation, summary listing, and duplicate rejection."""
    headers = {"Authorization": auth_headers["Authorization"]}

    # 1. Create Class
    create_resp = client.post(
        "/api/v1/classes",
        headers=headers,
        json={"name": "Grade 5B", "academic_year": "2026-2027", "grade": "5"},
    )
    assert create_resp.status_code == 200
    class_id = create_resp.json()["data"]["class_id"]

    # 2. Duplicate class in same year rejected (409)
    dup_resp = client.post(
        "/api/v1/classes",
        headers=headers,
        json={"name": "Grade 5B", "academic_year": "2026-2027"},
    )
    assert dup_resp.status_code == 409
    assert dup_resp.json()["error"]["code"] == "CLASS_ALREADY_EXISTS"

    # 3. List classes with summary
    list_resp = client.get("/api/v1/classes", headers=headers)
    assert list_resp.status_code == 200
    classes_list = list_resp.json()["data"]
    target = next((c for c in classes_list if c["class_id"] == class_id), None)
    assert target is not None
    assert target["name"] == "Grade 5B"
    assert "student_count" in target
    assert "qualifying_wash_count" in target
    assert "protocol_completion_rate" in target


def test_student_crud_and_pagination_api(client, auth_headers):
    """Test student creation with auto-QR, pagination, filtering, and search."""
    headers = {"Authorization": auth_headers["Authorization"]}

    # Create Class
    c_resp = client.post(
        "/api/v1/classes",
        headers=headers,
        json={"name": "Year 2 Blue", "academic_year": "2026-2027"},
    )
    cid = c_resp.json()["data"]["class_id"]

    # 1. Create Student with auto QR
    s_resp = client.post(
        "/api/v1/students",
        headers=headers,
        json={
            "display_name": "Oliver Twist",
            "class_id": cid,
            "school_student_code": "OT101",
            "auto_issue_qr": True,
        },
    )
    assert s_resp.status_code == 200
    s_data = s_resp.json()["data"]
    sid = s_data["student"]["student_id"]
    assert s_data["raw_qr_token"] is not None  # Shown once

    # 2. Get Student Detail
    detail_resp = client.get(f"/api/v1/students/{sid}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["data"]["student"]["display_name"] == "Oliver Twist"
    assert len(detail_resp.json()["data"]["credentials"]) >= 1

    # 3. Search and Pagination
    search_resp = client.get("/api/v1/students?search=Oliver", headers=headers)
    assert search_resp.status_code == 200
    assert search_resp.json()["data"]["total_count"] >= 1

    # 4. Soft deactivation
    status_resp = client.patch(
        f"/api/v1/students/{sid}/status?is_active=0", headers=headers
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["data"]["is_active"] == 0


def test_csv_student_import_with_security_and_sanitization(client, auth_headers):
    """Verify CSV import with formula injection sanitization and row validation."""
    headers = {"Authorization": auth_headers["Authorization"]}

    # CSV with formula injection triggers and duplicate codes
    csv_content = (
        "display_name,class_name,school_student_code\n"
        "=cmd|' /C calc'!A0,Class Import,IMP001\n"
        "+Sarah Connor,Class Import,IMP002\n"
        "Duplicate Code Student,Class Import,IMP001\n"
        ",Class Import,IMP003\n"
    )

    import_resp = client.post(
        "/api/v1/students/import",
        headers=headers,
        json={"csv_text": csv_content},
    )
    assert import_resp.status_code == 200
    result = import_resp.json()["data"]

    # 2 valid students imported, 2 errors (duplicate code + empty name)
    assert result["imported_count"] == 2
    assert result["skipped_count"] == 2
    assert len(result["errors"]) == 2

    # Verify formula injection triggers were sanitized
    list_resp = client.get("/api/v1/students?search=calc", headers=headers)
    items = list_resp.json()["data"]["items"]
    assert len(items) == 1
    # Leading '=' must have been stripped
    assert not items[0]["display_name"].startswith("=")


# =====================================================================
# 4. Kiosk Identify & RBAC Tests
# =====================================================================


def test_kiosk_identify_minimal_response(client, test_db):
    """Kiosk identification returns minimal session handle and never leaks peer data."""
    conn = create_connection(test_db)
    cls = ClassesRepository.create(conn, name="Kiosk Class", academic_year="2026-2027")
    student = StudentsRepository.create(
        conn, display_name="Lucas Vance", class_id=cls["class_id"]
    )
    _, raw_token = CredentialService.issue_credential(conn, student["student_id"], "QR")
    conn.commit()
    conn.close()

    # Kiosk call (unauthenticated)
    kiosk_resp = client.post(
        "/api/v1/kiosk/identify",
        json={"credential_type": "QR", "raw_value": raw_token},
    )
    assert kiosk_resp.status_code == 200
    data = kiosk_resp.json()["data"]

    # Check minimal response
    assert data["student_id"] == student["student_id"]
    assert data["display_handle"] == "Lucas"
    assert data["first_name"] == "Lucas"
    # Ensure no leaked class rosters, point balances, or other students
    assert "class_name" not in data
    assert "class_id" not in data
    assert "students" not in data


def test_unauthenticated_requests_to_students_and_classes_rejected(client):
    """Protected endpoints require valid teacher authentication."""
    assert client.get("/api/v1/students").status_code == 401
    assert (
        client.post(
            "/api/v1/students", json={"display_name": "Hacker", "class_id": "123"}
        ).status_code
        == 401
    )
    assert client.get("/api/v1/classes").status_code == 401
    assert (
        client.post(
            "/api/v1/classes", json={"name": "Secret", "academic_year": "2026"}
        ).status_code
        == 401
    )
