"""Tests for Bubsy vision feasibility pipeline.

Covers:
- Camera wrapper open/read/release with RAII context manager semantics
- Error states: CAMERA_NOT_FOUND, CAMERA_READ_FAILED
- Gesture enum and label normalization mapping
- Inference interface, latency tracking, frame validation, sidecar metadata parsing
- Privacy enforcement: zero cv2.imwrite, VideoWriter, or PIL save calls in vision package
- Privacy enforcement: zero facial recognition or face tracking libraries
- Evaluation report generation with scikit-learn metrics and leakage detection
"""

import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
from app.vision.camera import (
    CameraNotFoundError,
    CameraReadFailedError,
    WebcamCapture,
)
from app.vision.gestures import (
    GestureClass,
    normalize_gesture_label,
)
from app.vision.inference import (
    ModelNotFoundError,
    PredictionResult,
    StubGestureModel,
    create_gesture_model,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.evaluate_model import (
    check_dataset_split_leakage,
    extract_participant_and_session,
    generate_evaluation_report,
)


class DummyMockCapture:
    """Mock OpenCV VideoCapture for testing without hardware webcam."""

    def __init__(self, opened: bool = True, read_ok: bool = True) -> None:
        self._opened = opened
        self._read_ok = read_ok
        self.released = False

    def isOpened(self) -> bool:
        return self._opened and not self.released

    def read(self) -> tuple[bool, np.ndarray | None]:
        if not self._read_ok or self.released:
            return False, None
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        return True, frame

    def set(self, propId: int, value: float) -> bool:
        return True

    def release(self) -> None:
        self.released = True


def test_camera_context_manager_and_read():
    """Verify camera wrapper reads in-memory frames and releases on exit."""
    mock_cap = DummyMockCapture(opened=True, read_ok=True)

    with WebcamCapture(device_index=0, capture_factory=lambda idx: mock_cap) as cam:
        assert cam.is_opened() is True
        frame = cam.read()
        assert isinstance(frame, np.ndarray)
        assert frame.shape == (480, 640, 3)

    assert mock_cap.released is True
    assert cam.is_opened() is False


def test_camera_not_found_error():
    """Verify CameraNotFoundError is raised when capture device cannot open."""
    closed_cap = DummyMockCapture(opened=False)

    cam = WebcamCapture(device_index=99, capture_factory=lambda idx: closed_cap)
    with pytest.raises(CameraNotFoundError) as exc_info:
        cam.open()
    assert exc_info.value.code == "CAMERA_NOT_FOUND"


def test_camera_read_failed_error():
    """Verify CameraReadFailedError is raised when stream read fails."""
    broken_read_cap = DummyMockCapture(opened=True, read_ok=False)

    with (
        pytest.raises(CameraReadFailedError) as exc_info,
        WebcamCapture(
            device_index=0, capture_factory=lambda idx: broken_read_cap
        ) as cam,
    ):
        cam.read()
    assert exc_info.value.code == "CAMERA_READ_FAILED"


def test_gesture_enum_and_normalization():
    """Verify stable internal classes and label normalization mappings."""
    rubbing = GestureClass.rubbing_movements()
    assert len(rubbing) == 6
    assert GestureClass.PALM_TO_PALM in rubbing
    assert GestureClass.PALM_OVER_DORSUM in rubbing
    assert GestureClass.FINGERS_INTERLACED in rubbing
    assert GestureClass.BACKS_OF_FINGERS in rubbing
    assert GestureClass.THUMB_RUBBING in rubbing
    assert GestureClass.FINGERTIPS in rubbing

    # Normalization tests
    assert normalize_gesture_label("palm_to_palm") == GestureClass.PALM_TO_PALM
    assert normalize_gesture_label("Palm-To-Palm") == GestureClass.PALM_TO_PALM
    assert normalize_gesture_label("dorsum") == GestureClass.PALM_OVER_DORSUM
    assert normalize_gesture_label("step3") == GestureClass.FINGERS_INTERLACED
    assert normalize_gesture_label("opposing_palms") == GestureClass.BACKS_OF_FINGERS
    assert normalize_gesture_label("thumbs") == GestureClass.THUMB_RUBBING
    assert normalize_gesture_label("fingertips") == GestureClass.FINGERTIPS
    assert normalize_gesture_label("idle") == GestureClass.IDLE_BACKGROUND
    assert normalize_gesture_label("background") == GestureClass.IDLE_BACKGROUND
    assert normalize_gesture_label("completely_random_string") == GestureClass.UNKNOWN
    assert normalize_gesture_label(None) == GestureClass.UNKNOWN


def test_gesture_inference_and_frame_validation():
    """Verify GestureModel predicts typed results and rejects invalid frame structures."""
    model = create_gesture_model(use_stub=True)
    assert model.is_loaded is True

    valid_frame = np.full((480, 640, 3), 100, dtype=np.uint8)
    res = model.predict(valid_frame)

    assert isinstance(res, PredictionResult)
    assert res.label == GestureClass.PALM_TO_PALM
    assert res.confidence == 0.95
    assert res.latency_ms >= 0.0
    assert res.model_version == "v0.1.0-feasibility-stub"

    # Rejection of invalid inputs
    with pytest.raises(ValueError, match="Expected 3-channel"):
        model.predict(np.zeros((480, 640), dtype=np.uint8))  # 2D grayscale

    with pytest.raises(TypeError, match="Expected numpy ndarray"):
        model.predict([[1, 2], [3, 4]])  # Raw python list


def test_model_missing_file_and_sidecar_metadata():
    """Verify handling of missing model files and sidecar metadata version extraction."""
    model = StubGestureModel()

    with pytest.raises(ModelNotFoundError):
        model.load("models/non_existent_weights_xyz123.pt")

    # Create temporary model file with sidecar metadata
    with tempfile.TemporaryDirectory() as tmpdir:
        weights_file = Path(tmpdir) / "checkpoint_v2.pt"
        weights_file.write_bytes(b"dummy_weights_data")

        meta_file = Path(tmpdir) / "checkpoint_v2.json"
        meta_file.write_text(
            json.dumps(
                {"model_version": "v2.4.1-experimental", "architecture": "yolov8n"}
            ),
            encoding="utf-8",
        )

        model.load(weights_file)
        assert model.model_version == "v2.4.1-experimental"
        assert model.metadata.get("architecture") == "yolov8n"


def test_privacy_invariant_no_image_or_video_writes():
    """Assert vision package contains zero calls to cv2.imwrite, VideoWriter, or PIL save."""
    vision_dir = Path(__file__).resolve().parent.parent / "app" / "vision"
    assert vision_dir.is_dir()

    prohibited_patterns = [
        "imwrite",
        "VideoWriter",
        "Image.save",
        ".save(",
    ]

    for py_file in vision_dir.glob("*.py"):
        content = py_file.read_text(encoding="utf-8")
        for pattern in prohibited_patterns:
            assert pattern not in content, (
                f"Prohibited file persistence pattern '{pattern}' detected in vision module: {py_file.name}"
            )


def test_privacy_invariant_no_facial_recognition_dependencies():
    """Assert vision package does not import or implement facial recognition."""
    vision_dir = Path(__file__).resolve().parent.parent / "app" / "vision"

    prohibited_face_terms = [
        "face_recognition",
        "dlib",
        "haarcascade_frontalface",
        "facenet",
        "face_mesh",
        "face_detection",
    ]

    for py_file in vision_dir.glob("*.py"):
        content = py_file.read_text(encoding="utf-8").lower()
        for term in prohibited_face_terms:
            assert term not in content, (
                f"Prohibited facial recognition reference '{term}' found in vision module: {py_file.name}"
            )


def test_participant_leakage_detection():
    """Verify split leakage detection flags overlapping participants between train and test."""
    p1, s1 = extract_participant_and_session("p01_s02_frame100.png")
    assert p1 == "p01"
    assert s1 == "s02"

    with tempfile.TemporaryDirectory() as tmpdir:
        train_dir = Path(tmpdir) / "train"
        train_dir.mkdir()
        (train_dir / "p01_s01_001.png").write_bytes(b"")

        # Test set sharing participant p01
        test_files_leaked = ["p01_s02_002.png", "p02_s01_001.png"]
        leaked, msg = check_dataset_split_leakage(
            test_files_leaked, train_dir=train_dir
        )
        assert leaked is True
        assert "SUSPECTED DATA LEAKAGE" in msg

        # Test set with independent participant p03
        test_files_clean = ["p03_s01_001.png"]
        clean_leaked, _clean_msg = check_dataset_split_leakage(
            test_files_clean, train_dir=train_dir
        )
        assert clean_leaked is False


def test_generate_evaluation_report_markdown():
    """Verify evaluation report markdown generation with scikit-learn metrics."""
    with tempfile.TemporaryDirectory() as tmpdir:
        out_file = Path(tmpdir) / "eval_report.md"

        y_true = ["PALM_TO_PALM", "PALM_TO_PALM", "THUMB_RUBBING"]
        y_pred = ["PALM_TO_PALM", "PALM_TO_PALM", "THUMB_RUBBING"]
        latencies = [15.2, 14.8, 16.0]

        report_md = generate_evaluation_report(
            model_version="v0.1.0-test",
            y_true=y_true,
            y_pred=y_pred,
            latencies=latencies,
            leakage_warning="Split verified cleanly.",
            data_dir_path="/data/test",
            output_markdown_path=out_file,
        )

        assert out_file.is_file()
        assert "# Model Evaluation Report: v0.1.0-test" in report_md
        assert "Macro F1-Score" in report_md
        assert "Confusion Matrix" in report_md
        assert "PASSED" in report_md
