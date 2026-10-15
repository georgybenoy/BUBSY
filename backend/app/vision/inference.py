"""Gesture recognition model inference interface and implementations for Bubsy.

Handles model loading, sidecar metadata inspection, inference latency tracking,
input validation, and mapping raw predictions to stable GestureClass enums.
"""

import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.logging import logger
from app.vision.gestures import GestureClass, normalize_gesture_label


class VisionModelError(Exception):
    """Base exception for vision inference models."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ModelNotFoundError(VisionModelError):
    """Raised when the requested model weights file cannot be found."""

    def __init__(
        self, message: str = "Gesture model weights file was not found."
    ) -> None:
        super().__init__("MODEL_NOT_FOUND", message)


class ModelLoadError(VisionModelError):
    """Raised when model weights fail to initialize, load, or parse."""

    def __init__(self, message: str = "Failed to load gesture model weights.") -> None:
        super().__init__("MODEL_LOAD_FAILED", message)


@dataclass(frozen=True)
class PredictionResult:
    """Strongly typed prediction output from a single video frame inference."""

    label: GestureClass
    confidence: float
    latency_ms: float
    raw_label: str
    model_version: str


class GestureModel(ABC):
    """Abstract base class for handwashing gesture recognition models."""

    def __init__(self) -> None:
        self.model_version: str = "unknown"
        self.metadata: dict[str, Any] = {}
        self.is_loaded: bool = False

    @abstractmethod
    def load(self, model_path: str | Path) -> None:
        """Load model weights and sidecar metadata from disk.

        Raises:
            ModelNotFoundError: If model file does not exist.
            ModelLoadError: If model cannot be parsed or loaded.
        """

    @abstractmethod
    def predict(self, frame: np.ndarray) -> PredictionResult:
        """Run gesture prediction on a single in-memory video frame.

        Args:
            frame: np.ndarray with shape (H, W, 3) and uint8 dtype.

        Returns:
            PredictionResult with normalized label, confidence, and latency.

        Raises:
            ValueError: If frame is invalid or malformed.
            ModelLoadError: If called before load().
        """

    def _load_sidecar_metadata(self, model_path: Path) -> dict[str, Any]:
        """Find and read sidecar metadata JSON file alongside the model weights."""
        candidate_paths = [
            model_path.with_suffix(".json"),
            model_path.parent / f"{model_path.stem}_metadata.json",
            model_path.parent / "metadata.json",
            model_path.parent / "model.json",
        ]

        for meta_path in candidate_paths:
            if meta_path.is_file():
                try:
                    with open(meta_path, encoding="utf-8") as f:
                        data = json.load(f)
                        logger.info("Loaded sidecar metadata from %s", meta_path)
                        return data if isinstance(data, dict) else {}
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "Could not parse sidecar metadata at %s: %s", meta_path, exc
                    )

        return {}

    @staticmethod
    def _validate_frame(frame: np.ndarray) -> None:
        """Validate that the input is a valid 3-channel numpy frame."""
        if not isinstance(frame, np.ndarray):
            raise TypeError(f"Expected numpy ndarray frame, got {type(frame)}")
        if frame.ndim != 3 or frame.shape[2] != 3:
            raise ValueError(
                f"Expected 3-channel (H, W, 3) frame array, got shape {frame.shape}"
            )
        if frame.size == 0:
            raise ValueError("Frame array is empty (size 0)")


class StubGestureModel(GestureModel):
    """Deterministic stub gesture model for testing, benchmarks, and fallback.

    Operates entirely in-memory with synthetic predictions, avoiding external weights.
    """

    def __init__(
        self,
        default_label: GestureClass = GestureClass.PALM_TO_PALM,
        default_confidence: float = 0.95,
        model_version: str = "v0.1.0-feasibility-stub",
    ) -> None:
        super().__init__()
        self.default_label = default_label
        self.default_confidence = default_confidence
        self.model_version = model_version
        self.is_loaded = True

    def load(self, model_path: str | Path) -> None:
        path = Path(model_path)
        if not path.exists():
            raise ModelNotFoundError(f"Model file does not exist at {path}")

        meta = self._load_sidecar_metadata(path)
        self.metadata = meta
        self.model_version = meta.get("model_version", self.model_version)
        self.is_loaded = True

    def predict(self, frame: np.ndarray) -> PredictionResult:
        start_time = time.perf_counter()
        self._validate_frame(frame)

        # Perform synthetic mathematical computation on frame to simulate lightweight inference
        _ = float(np.mean(frame[:10, :10, :]))

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return PredictionResult(
            label=self.default_label,
            confidence=self.default_confidence,
            latency_ms=latency_ms,
            raw_label=self.default_label.value.lower(),
            model_version=self.model_version,
        )


class YoloGestureModel(GestureModel):
    """Ultralytics YOLO wrapper for handwashing gesture classification.

    Loads approved model checkpoints (.pt) and processes frames in-memory.
    """

    def __init__(self) -> None:
        super().__init__()
        self._model: Any = None

    def load(self, model_path: str | Path) -> None:
        path = Path(model_path)
        if not path.is_file():
            logger.error("YOLO weights file not found: %s", path)
            raise ModelNotFoundError(f"Model weights file not found at: {path}")

        meta = self._load_sidecar_metadata(path)
        self.metadata = meta
        self.model_version = meta.get("model_version", path.stem)

        try:
            from ultralytics import YOLO

            self._model = YOLO(str(path))
            self.is_loaded = True
            logger.info(
                "Successfully loaded YOLO gesture model from %s (version: %s)",
                path,
                self.model_version,
            )
        except Exception as exc:
            logger.error("Failed to load YOLO model from %s: %s", path, exc)
            raise ModelLoadError(
                f"Failed to initialize YOLO model from {path}: {exc}"
            ) from exc

    def predict(self, frame: np.ndarray) -> PredictionResult:
        if not self.is_loaded or self._model is None:
            raise ModelLoadError(
                "predict() called before model was successfully loaded."
            )

        start_time = time.perf_counter()
        self._validate_frame(frame)

        try:
            # Run inference in-memory with verbose=False
            results = self._model(frame, verbose=False)
            latency_ms = (time.perf_counter() - start_time) * 1000.0

            if not results or len(results) == 0:
                return PredictionResult(
                    label=GestureClass.UNKNOWN,
                    confidence=0.0,
                    latency_ms=latency_ms,
                    raw_label="unknown",
                    model_version=self.model_version,
                )

            res = results[0]

            # Classification model output
            if hasattr(res, "probs") and res.probs is not None:
                top1_idx = int(res.probs.top1)
                conf = float(res.probs.top1conf)
                raw_label = res.names.get(top1_idx, str(top1_idx))
            elif hasattr(res, "boxes") and res.boxes is not None and len(res.boxes) > 0:
                # Detection model output: pick highest confidence box
                top_box = max(res.boxes, key=lambda b: float(b.conf[0]))
                cls_idx = int(top_box.cls[0])
                conf = float(top_box.conf[0])
                raw_label = res.names.get(cls_idx, str(cls_idx))
            else:
                raw_label = "unknown"
                conf = 0.0

            normalized_label = normalize_gesture_label(raw_label)

            return PredictionResult(
                label=normalized_label,
                confidence=conf,
                latency_ms=latency_ms,
                raw_label=raw_label,
                model_version=self.model_version,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Error during gesture model inference: %s", exc)
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return PredictionResult(
                label=GestureClass.UNKNOWN,
                confidence=0.0,
                latency_ms=latency_ms,
                raw_label=f"error_{type(exc).__name__}",
                model_version=self.model_version,
            )


def create_gesture_model(
    model_path: str | Path | None = None,
    use_stub: bool = False,
) -> GestureModel:
    """Factory creating an initialized gesture model.

    If use_stub is True or model_path is None, returns a StubGestureModel.
    Otherwise attempts to load a YoloGestureModel.
    """
    if use_stub or model_path is None:
        stub = StubGestureModel()
        if model_path is not None:
            stub.load(model_path)
        return stub

    model = YoloGestureModel()
    model.load(model_path)
    return model
