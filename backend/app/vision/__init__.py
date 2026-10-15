"""Bubsy computer vision package.

Provides OpenCV camera capture, gesture classification interface,
and stable movement class mappings.

Privacy invariants:
- Camera frames stay in memory only.
- No frames or session videos are persisted to disk.
- Zero face detection or biometric tracking.
"""

from app.vision.camera import (
    CameraBusyError,
    CameraError,
    CameraNotFoundError,
    CameraReadFailedError,
    WebcamCapture,
)
from app.vision.gestures import (
    LABEL_NORMALIZATION_MAP,
    GestureClass,
    normalize_gesture_label,
)
from app.vision.inference import (
    GestureModel,
    ModelLoadError,
    ModelNotFoundError,
    PredictionResult,
    StubGestureModel,
    VisionModelError,
    YoloGestureModel,
    create_gesture_model,
)
from app.vision.runner import CameraMode, VisionRunner
from app.vision.temporal import (
    PredictionSample,
    TemporalConfig,
    TemporalEvaluationResult,
    TemporalSlidingWindow,
    TemporalStatus,
)

__all__ = [
    "LABEL_NORMALIZATION_MAP",
    "CameraBusyError",
    "CameraError",
    "CameraMode",
    "CameraNotFoundError",
    "CameraReadFailedError",
    "GestureClass",
    "GestureModel",
    "ModelLoadError",
    "ModelNotFoundError",
    "PredictionResult",
    "PredictionSample",
    "StubGestureModel",
    "TemporalConfig",
    "TemporalEvaluationResult",
    "TemporalSlidingWindow",
    "TemporalStatus",
    "VisionModelError",
    "VisionRunner",
    "WebcamCapture",
    "YoloGestureModel",
    "create_gesture_model",
    "normalize_gesture_label",
]
