"""Device recovery and fault tolerance tests for Bubsy.

Verifies system resilience against hardware and environment failures:
1. No webcam detected (CAMERA_NOT_FOUND)
2. No model weights file present
3. Database transient failure / transaction abort
4. Camera disconnects mid-session
5. System restart after interrupted/incomplete session
"""

import os
import sqlite3
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.reward_transactions_repo import RewardTransactionsRepository
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.services.kiosk_session_manager import KioskSessionManager
from app.vision.camera import (
    CameraNotFoundError,
    CameraReadFailedError,
    WebcamCapture,
)
from app.vision.inference import (
    ModelNotFoundError,
    StubGestureModel,
    YoloGestureModel,
)
from app.vision.runner import CameraMode, VisionRunner


@pytest.fixture
def recovery_db(tmp_path: Path):
    """Isolated temporary SQLite database for device recovery testing."""
    db_file = tmp_path / "test_recovery.db"
    conn = create_connection(db_file)
    run_migrations(db_file)

    with transaction(conn):
        cls_data = ClassesRepository.create(
            conn, name="Class 4B", academic_year="2026-2027", grade="4"
        )
        student_data = StudentsRepository.create(
            conn,
            display_name="Charlie B.",
            class_id=cls_data["class_id"],
            school_student_code="STU-REC-01",
        )

    yield db_file, conn, student_data["student_id"]
    conn.close()


def test_device_recovery_no_webcam():
    """Verify system handles missing webcam gracefully without crashing."""
    with patch("cv2.VideoCapture") as mock_cap_class:
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = False
        mock_cap_class.return_value = mock_cap

        camera = WebcamCapture(device_index=99)
        with pytest.raises(CameraNotFoundError) as exc_info:
            camera.open()

        assert "99" in str(exc_info.value)
        assert camera.is_opened() is False
        camera.release()


def test_device_recovery_no_model_file(tmp_path: Path):
    """Verify system handles absent or corrupted model files explicitly."""
    non_existent = tmp_path / "missing_yolo_weights.pt"
    yolo_model = YoloGestureModel()

    with pytest.raises(ModelNotFoundError) as exc_info:
        yolo_model.load(non_existent)

    assert "not found" in str(exc_info.value).lower()
    assert yolo_model.model_version == "unknown"

    # Stub fallback loads when file exists
    stub_file = tmp_path / "stub.pt"
    stub_file.write_text("stub_weights")
    fallback_model = StubGestureModel()
    fallback_model.load(stub_file)
    assert "stub" in fallback_model.model_version


def test_device_recovery_db_transaction_rollback(recovery_db):
    """Verify that transient database errors trigger clean transaction rollbacks."""
    db_file, conn, student_id = recovery_db

    initial_rewards = RewardTransactionsRepository.list_by_student(conn, student_id)

    # Simulate an error inside transaction
    with pytest.raises(RuntimeError):
        with transaction(conn):
            SessionsRepository.create(
                conn,
                kiosk_id="kiosk_test_1",
                student_id=student_id,
                protocol_version="v1.0",
                model_version="v1.0",
                outcome="incomplete",
            )
            # Deliberately raise to abort transaction
            raise RuntimeError("Simulated power outage / disk I/O fault mid-transaction")

    # Verify no partial or orphaned rows were committed
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sessions WHERE student_id = ?", (student_id,))
    assert cur.fetchone()[0] == 0

    assert len(RewardTransactionsRepository.list_by_student(conn, student_id)) == len(initial_rewards)


def test_device_recovery_camera_disconnect_mid_session():
    """Verify that camera disconnect mid-session is caught and diagnostics report disconnected."""
    class DisconnectingCamera:
        def __init__(self):
            self.opened = True
            self.should_fail = False

        def open(self):
            self.opened = True

        def is_opened(self):
            return self.opened

        def read(self):
            if self.should_fail:
                raise CameraReadFailedError("Simulated USB disconnection mid-session")
            return np.zeros((480, 640, 3), dtype=np.uint8)

        def close(self):
            self.opened = False

    cam = DisconnectingCamera()
    runner = VisionRunner(camera_factory=lambda: cam)
    runner.set_mode(CameraMode.WASH)
    time.sleep(0.05)
    assert cam.is_opened()

    # Trigger disconnect
    cam.should_fail = True
    time.sleep(0.08)

    diag = runner.get_diagnostics()
    assert diag["camera"]["status"] in ("disconnected", "idle")
    assert len(diag["recent_errors"]) > 0
    assert "Simulated USB disconnection" in diag["recent_errors"][0]["error"]
    runner.close()


def test_device_recovery_restart_after_incomplete_session(recovery_db):
    """Verify reboot recovery: sessions left incomplete are marked with zero rewards."""
    db_file, conn, student_id = recovery_db

    # Create two incomplete sessions left behind by an unexpected termination
    with transaction(conn):
        s1 = SessionsRepository.create(
            conn,
            kiosk_id="kiosk_test_1",
            student_id=student_id,
            protocol_version="v1.0",
            model_version="v1.0",
            outcome="incomplete",
        )
        s2 = SessionsRepository.create(
            conn,
            kiosk_id="kiosk_test_1",
            student_id=student_id,
            protocol_version="v1.0",
            model_version="v1.0",
            outcome="incomplete",
        )

    # Execute recovery routine (called in app lifespan startup)
    recovered_count = KioskSessionManager.recover_interrupted_sessions(conn)
    assert recovered_count >= 2

    # Verify both sessions have qualifies_for_points == 0 and failure_reason recorded
    sess1 = SessionsRepository.get_by_id(conn, s1["session_id"])
    sess2 = SessionsRepository.get_by_id(conn, s2["session_id"])
    assert sess1["qualifies_for_points"] == 0
    assert sess1["failure_reason"] == "SYSTEM_RESTART_RECOVERY"
    assert sess2["qualifies_for_points"] == 0
    assert sess2["failure_reason"] == "SYSTEM_RESTART_RECOVERY"

    # Crucial security invariant: no rewards generated
    reward1 = RewardTransactionsRepository.get_by_idempotency_key(
        conn, f"reward:session:{s1['session_id']}"
    )
    assert reward1 is None
