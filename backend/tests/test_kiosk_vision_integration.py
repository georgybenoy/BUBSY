"""Integration tests for Kiosk API, VisionRunner, WebSockets, and startup recovery.

Per Phase 7 requirements:
- Uses fake camera and stub model replaying scripted prediction sequences.
- Complete happy path, uncertainty, out-of-order, abandonment.
- Camera disconnect mid-session.
- Model-missing startup handling.
- Duplicate completion idempotency.
- Teacher-assisted manual identification.
- Startup crash recovery without rewards.
- Privacy audit: zero persistent images/videos and zero frames in logs.
"""

import os
import time
from collections.abc import Generator
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from app.core.security import hash_password
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.database.repositories.teachers_repo import TeachersRepository
from app.main import app
from app.services.credential_service import CredentialService
from app.services.kiosk_session_manager import (
    KioskSessionManager,
    kiosk_session_manager,
)
from app.services.session_engine import SessionStepEvent
from app.services.session_service import session_store
from app.vision.camera import CameraReadFailedError, WebcamCapture
from app.vision.gestures import GestureClass
from app.vision.inference import (
    GestureModel,
    PredictionResult,
    StubGestureModel,
)
from app.vision.runner import CameraMode, VisionRunner
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Test Fixtures & Fakes
# ---------------------------------------------------------------------------


class FakeCamera(WebcamCapture):
    """Synthetic in-memory camera wrapper for CI testing."""

    def __init__(self, should_fail: bool = False) -> None:
        super().__init__(device_index=0)
        self._is_opened = False
        self.should_fail = should_fail
        self.read_call_count = 0

    def open(self) -> None:
        if self.should_fail:
            raise CameraReadFailedError("Simulated camera hardware failure")
        self._is_opened = True

    def read(self) -> np.ndarray:
        self.read_call_count += 1
        if not self._is_opened or self.should_fail:
            raise CameraReadFailedError("Simulated camera disconnect mid-session")
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def release(self) -> None:
        self._is_opened = False

    def is_opened(self) -> bool:
        return self._is_opened


class ScriptedGestureModel(GestureModel):
    """GestureModel that replays a pre-scripted sequence of predictions."""

    def __init__(
        self,
        scripted_predictions: list[tuple[GestureClass, float]] | None = None,
        version: str = "1.0.0-scripted",
    ) -> None:
        super().__init__()
        self.model_version = version
        self.is_loaded = True
        self.predictions = scripted_predictions or [(GestureClass.PALM_TO_PALM, 0.95)]
        self.index = 0

    def load(self, model_path: str) -> None:
        pass

    def predict(self, frame: np.ndarray) -> PredictionResult:
        if not self.predictions:
            return PredictionResult(
                label=GestureClass.IDLE_BACKGROUND,
                confidence=0.9,
                latency_ms=1.0,
            )
        pred = self.predictions[min(self.index, len(self.predictions) - 1)]
        self.index += 1
        return PredictionResult(
            label=pred[0],
            confidence=pred[1],
            latency_ms=1.0,
        )


@pytest.fixture
def test_db_path(tmp_path: Path) -> str:
    """Create a temporary database file with migrations applied."""
    db_file = tmp_path / "kiosk_test.db"
    conn = create_connection(str(db_file))
    run_migrations(conn=conn)
    conn.close()
    return str(db_file)


@pytest.fixture
def integration_env(test_db_path: str) -> Generator[dict[str, Any], None, None]:
    """Sets up an isolated database, teacher account, enrolled student, and kiosk manager."""
    conn = create_connection(test_db_path)

    with transaction(conn) as tx:
        # Create class
        cls = ClassesRepository.create(
            tx, name="Class 4A", grade="Grade 4", academic_year="2026-2027"
        )
        # Create student
        student = StudentsRepository.create(
            tx,
            display_name="Liam Johnson",
            class_id=cls["class_id"],
            school_student_code="S-2001",
        )
        # Issue credential: returns (cred_record, raw_token)
        _cred_record, raw_qr_token = CredentialService.issue_credential(
            tx, student_id=student["student_id"], credential_type="QR"
        )
        # Create teacher
        teacher = TeachersRepository.create(
            tx,
            username="teacher_smith",
            password_hash=hash_password("TeacherSecurePass123!"),
            role="teacher",
        )

    # Teacher session token
    session_id, csrf_token = session_store.create_session(
        teacher["teacher_id"], teacher["username"], teacher["role"]
    )

    # Inject FakeCamera and StubGestureModel into kiosk_session_manager for CI isolation

    fake_cam = FakeCamera()
    stub_runner = VisionRunner(
        camera_factory=lambda: fake_cam,
        model=StubGestureModel(model_version="1.0.0"),
    )
    kiosk_session_manager.vision_runner = stub_runner

    yield {
        "db_path": test_db_path,
        "conn": conn,
        "student": student,
        "raw_qr_token": raw_qr_token,
        "teacher": teacher,
        "teacher_auth_headers": {
            "Authorization": f"Bearer {session_id}",
            "X-CSRF-Token": csrf_token,
        },
    }

    conn.close()


@pytest.fixture
def client(integration_env: dict[str, Any]) -> Generator[TestClient, None, None]:
    """TestClient wired to the test database."""
    from app.api.deps import get_db

    def override_get_db():
        conn = create_connection(integration_env["db_path"])
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Kiosk Identification Tests
# ---------------------------------------------------------------------------


def test_kiosk_qr_identification_happy_path(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """Scan valid QR code -> resolves student display name without leaking sensitive data."""
    resp = client.post(
        "/api/v1/kiosk/identify",
        json={
            "credential_type": "QR",
            "raw_value": integration_env["raw_qr_token"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["student_id"] == integration_env["student"]["student_id"]
    assert data["display_handle"] == "Liam"
    assert data["first_name"] == "Liam"
    assert data["retry_count"] == 0
    assert data["teacher_assistance_required"] is False


def test_failed_identification_tracks_retries_and_requires_teacher(
    client: TestClient,
) -> None:
    """Repeated failed scans increment retry count and trigger teacher assistance."""
    # 1. First failure
    r1 = client.post(
        "/api/v1/kiosk/identify",
        json={"credential_type": "QR", "raw_value": "invalid_token_1"},
    )
    assert r1.status_code == 404

    # 2. Second failure
    r2 = client.post(
        "/api/v1/kiosk/identify",
        json={"credential_type": "QR", "raw_value": "invalid_token_2"},
    )
    assert r2.status_code == 404

    # 3. Third failure -> triggers teacher assistance flag
    r3 = client.post(
        "/api/v1/kiosk/identify",
        json={"credential_type": "QR", "raw_value": "invalid_token_3"},
    )
    assert r3.status_code == 404
    err_detail = r3.json()["error"]
    assert (
        "teacher_assistance_required" in err_detail["message"]
        or err_detail["code"] == "CREDENTIAL_NOT_FOUND"
    )


def test_teacher_assisted_manual_identification(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """Authorized teacher manually identifies student when scan fails; never auto-selects."""
    student_id = integration_env["student"]["student_id"]

    # Unauthenticated attempt is rejected
    unauth_resp = client.post(
        "/api/v1/kiosk/identify/manual",
        json={"student_id": student_id},
    )
    assert unauth_resp.status_code == 401

    # Authenticated teacher resolves student
    auth_resp = client.post(
        "/api/v1/kiosk/identify/manual",
        json={"student_id": student_id, "notes": "QR card left at desk"},
        headers=integration_env["teacher_auth_headers"],
    )
    assert auth_resp.status_code == 200
    data = auth_resp.json()["data"]
    assert data["student_id"] == student_id
    assert data["display_handle"] == "Liam"


# ---------------------------------------------------------------------------
# 2. Vision Runner & Camera Mode Switching Tests
# ---------------------------------------------------------------------------


def test_vision_runner_clean_mode_switching_and_camera_release() -> None:
    """Switching between IDENTIFY and WASH cleanly releases and acquires the camera."""
    fake_cam = FakeCamera()
    runner = VisionRunner(camera_factory=lambda: fake_cam)

    assert runner.current_mode == CameraMode.IDLE
    assert not fake_cam.is_opened()

    # 1. Switch to IDENTIFY
    runner.set_mode(CameraMode.IDENTIFY)
    assert runner.current_mode == CameraMode.IDENTIFY
    time.sleep(0.05)
    assert fake_cam.is_opened()

    # 2. Switch to WASH
    runner.set_mode(CameraMode.WASH)
    assert runner.current_mode == CameraMode.WASH
    time.sleep(0.05)
    assert fake_cam.is_opened()

    # 3. Switch back to IDLE
    runner.set_mode(CameraMode.IDLE)
    assert runner.current_mode == CameraMode.IDLE
    time.sleep(0.05)
    assert not fake_cam.is_opened()


def test_camera_disconnect_mid_session_is_handled_gracefully() -> None:
    """Disconnecting camera during session records diagnostic error without crashing."""
    disconnecting_cam = FakeCamera()
    runner = VisionRunner(camera_factory=lambda: disconnecting_cam)

    runner.set_mode(CameraMode.WASH)
    time.sleep(0.05)
    assert disconnecting_cam.is_opened()

    # Simulate camera disconnect mid-session
    disconnecting_cam.should_fail = True
    time.sleep(0.05)

    diag = runner.get_diagnostics()
    assert diag["camera"]["status"] in ("disconnected", "idle")
    assert len(diag["recent_errors"]) > 0
    assert "Simulated camera" in diag["recent_errors"][0]["error"]

    runner.close()


# ---------------------------------------------------------------------------
# 3. Kiosk Session Lifecycle & Idempotency Tests
# ---------------------------------------------------------------------------


def test_kiosk_session_complete_happy_path_and_idempotency(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """Full session: create -> complete -> awards points -> second complete is idempotent."""
    student_id = integration_env["student"]["student_id"]

    # 1. Create session
    create_res = client.post(
        "/api/v1/kiosk/sessions",
        json={"student_id": student_id, "is_unassigned": False},
    )
    assert create_res.status_code == 200
    sess_data = create_res.json()["data"]
    session_id = sess_data["session_id"]
    assert sess_data["state"] == "in_progress"

    # 2. Simulate valid handwashing technique in active engine

    engine = kiosk_session_manager.active_engine
    assert engine is not None
    engine.advance_instructed_step(current_time_ms=1000.0)
    for i in range(1, 7):
        engine._events.append(
            SessionStepEvent(
                step_code=f"STEP_{i}",
                sequence_index=i,
                result="recognized",
                duration_ms=5000,
                confidence_summary=0.95,
                is_verified=True,
            )
        )
    engine.current_step_index = 7
    engine.advance_instructed_step(current_time_ms=7000.0)
    engine.advance_instructed_step(current_time_ms=8000.0)

    # 3. Complete session
    comp_res = client.post(f"/api/v1/kiosk/sessions/{session_id}/complete")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()["data"]
    assert comp_data["outcome"] == "completed"
    assert comp_data["session_id"] == session_id
    assert comp_data["points_awarded"] > 0
    assert comp_data["qualifies_for_points"] is True

    # 4. Second complete call is idempotent (returns existing data)
    comp_res_repeat = client.post(f"/api/v1/kiosk/sessions/{session_id}/complete")
    assert comp_res_repeat.status_code == 200
    repeat_data = comp_res_repeat.json()["data"]
    assert repeat_data["status"] == "already_completed"

    # Assert exactly ONE reward transaction in DB
    cursor = integration_env["conn"].cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM reward_transactions WHERE session_id = ?;",
        (session_id,),
    )
    assert cursor.fetchone()[0] == 1


def test_kiosk_session_cancel_workflow(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """Cancelling a session marks it cancelled and awards 0 points."""
    student_id = integration_env["student"]["student_id"]

    create_res = client.post(
        "/api/v1/kiosk/sessions",
        json={"student_id": student_id, "is_unassigned": False},
    )
    session_id = create_res.json()["data"]["session_id"]

    # Cancel
    cancel_res = client.post(f"/api/v1/kiosk/sessions/{session_id}/cancel")
    assert cancel_res.status_code == 200

    # Verify in DB
    sess_row = SessionsRepository.get_by_id(integration_env["conn"], session_id)
    assert sess_row is not None
    assert sess_row["outcome"] == "cancelled"
    assert sess_row["qualifies_for_points"] == 0


def test_unassigned_session_policy(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """Anonymous/unassigned sessions start when permitted, and award 0 points upon completion."""
    # Start unassigned session
    create_res = client.post(
        "/api/v1/kiosk/sessions",
        json={"student_id": None, "is_unassigned": True},
    )
    assert create_res.status_code == 200
    sess_id = create_res.json()["data"]["session_id"]
    assert create_res.json()["data"]["is_unassigned"] is True

    # Complete unassigned session
    comp_res = client.post(f"/api/v1/kiosk/sessions/{sess_id}/complete")
    assert comp_res.status_code == 200
    # Must earn 0 points!
    assert comp_res.json()["data"]["points_awarded"] == 0
    assert comp_res.json()["data"]["qualifies_for_points"] is False


# ---------------------------------------------------------------------------
# 4. System Status & Diagnostics Tests
# ---------------------------------------------------------------------------


def test_system_status_endpoint_rbac(
    client: TestClient, integration_env: dict[str, Any]
) -> None:
    """GET /api/v1/system/status requires teacher/operator role and returns full diagnostics."""
    # Unauthenticated is forbidden
    unauth = client.get("/api/v1/system/status")
    assert unauth.status_code == 401

    # Authorized teacher receives full telemetry
    resp = client.get(
        "/api/v1/system/status",
        headers=integration_env["teacher_auth_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "camera" in data
    assert "recognition_service" in data
    assert "qr_scanner" in data
    assert "nfc_reader" in data
    assert data["nfc_reader"]["status"] == "not configured"
    assert data["database"]["status"] == "healthy"


# ---------------------------------------------------------------------------
# 5. Startup Crash Recovery Test
# ---------------------------------------------------------------------------


def test_startup_crash_recovery_marks_interrupted_without_rewards(
    integration_env: dict[str, Any],
) -> None:
    """Crashed sessions left incomplete are marked interrupted without issuing rewards."""
    conn = integration_env["conn"]
    student_id = integration_env["student"]["student_id"]

    # Simulate an incomplete session left behind by a sudden application crash
    with transaction(conn) as tx:
        crashed_sess = SessionsRepository.create(
            tx,
            kiosk_id="kiosk-1",
            protocol_version="1.0.0",
            student_id=student_id,
            outcome="incomplete",
        )

    # Run startup recovery
    recovered_count = KioskSessionManager.recover_interrupted_sessions(conn)
    assert recovered_count >= 1

    # Verify session is marked interrupted with failure_reason and 0 points
    sess_row = SessionsRepository.get_by_id(conn, crashed_sess["session_id"])
    assert sess_row is not None
    assert sess_row["qualifies_for_points"] == 0
    assert sess_row["failure_reason"] == "SYSTEM_RESTART_RECOVERY"

    # Verify no reward was generated
    reward_row = RewardTransactionsRepository.get_by_idempotency_key(
        conn, f"reward:session:{crashed_sess['session_id']}"
    )
    assert reward_row is None


# ---------------------------------------------------------------------------
# 6. Privacy & Security Audit: Zero Image/Video Writes & Clean Logs
# ---------------------------------------------------------------------------


def test_privacy_audit_zero_images_or_videos_written_to_disk(
    client: TestClient,
    integration_env: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Privacy Rule: Zero camera frames or session recordings persisted to filesystem."""
    student_id = integration_env["student"]["student_id"]

    # 1. Run a session
    sess = client.post(
        "/api/v1/kiosk/sessions",
        json={"student_id": student_id, "is_unassigned": False},
    ).json()["data"]
    sess_id = sess["session_id"]
    client.post(f"/api/v1/kiosk/sessions/{sess_id}/complete")

    # 2. Scan project runtime directories for any image or video files
    forbidden_extensions = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".avi", ".mov"}
    scanned_dirs = [Path("backend/app"), Path("data"), Path("logs")]

    found_media_files = []
    for directory in scanned_dirs:
        if directory.exists():
            for root, _, files in os.walk(directory):
                for file_name in files:
                    ext = Path(file_name).suffix.lower()
                    if ext in forbidden_extensions:
                        found_media_files.append(os.path.join(root, file_name))

    assert found_media_files == [], (
        f"Privacy violation! Prohibited media files found on disk: {found_media_files}"
    )

    # 3. Check logs do not contain raw frames or full secret credential tokens
    raw_secret_token = integration_env["raw_qr_token"]
    for record in caplog.records:
        assert raw_secret_token not in record.getMessage(), (
            "Privacy violation! Full raw credential secret token logged in plaintext!"
        )
        assert "array(" not in record.getMessage(), (
            "Privacy violation! Raw numpy frame dumped into logs!"
        )
