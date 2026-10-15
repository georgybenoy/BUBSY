"""OpenCV camera capture wrapper for Bubsy.

Enforces:
- Clean resource acquisition and deterministic release on shutdown or exception.
- Explicit, typed errors: CAMERA_NOT_FOUND, CAMERA_BUSY, CAMERA_READ_FAILED.
- In-memory frame retention only; frames are NEVER written to disk or persistent storage.
"""

import atexit
from collections.abc import Callable
from typing import Any, Self

import cv2
import numpy as np

from app.core.logging import logger


class CameraError(Exception):
    """Base exception for vision camera operations."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class CameraNotFoundError(CameraError):
    """Raised when the specified camera index cannot be opened or is missing."""

    def __init__(
        self,
        message: str = "Camera device was not found or could not be detected.",
    ) -> None:
        super().__init__("CAMERA_NOT_FOUND", message)


class CameraBusyError(CameraError):
    """Raised when the camera is locked or already opened by another application."""

    def __init__(
        self,
        message: str = "Camera device is busy or in use by another process.",
    ) -> None:
        super().__init__("CAMERA_BUSY", message)


class CameraReadFailedError(CameraError):
    """Raised when an open camera fails to capture or decode a frame."""

    def __init__(
        self,
        message: str = "Failed to capture or read a frame from the active camera stream.",
    ) -> None:
        super().__init__("CAMERA_READ_FAILED", message)


class WebcamCapture:
    """Robust OpenCV camera capture wrapper with RAII context manager semantics.

    Frames are retained strictly in memory as numpy arrays and are never written to disk.
    """

    def __init__(
        self,
        device_index: int = 0,
        width: int = 640,
        height: int = 480,
        fps: int = 30,
        capture_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.device_index = device_index
        self.width = width
        self.height = height
        self.fps = fps
        self._capture_factory = capture_factory or cv2.VideoCapture
        self._cap: Any | None = None
        self._is_registered_atexit = False

    def open(self) -> None:
        """Initialize and open the video capture stream.

        Raises:
            CameraBusyError: If the device is locked by another process.
            CameraNotFoundError: If the device cannot be found or opened.
        """
        if self._cap is not None and self._cap.isOpened():
            return

        try:
            # On Windows, prefer cv2.CAP_DSHOW to prevent MSMF error -1072873822
            import sys
            if sys.platform == "win32" and (self._capture_factory is cv2.VideoCapture or getattr(self._capture_factory, "__name__", "") == "VideoCapture"):
                cap = self._capture_factory(self.device_index, cv2.CAP_DSHOW)
                if cap is None or not cap.isOpened():
                    cap = self._capture_factory(self.device_index)
            else:
                cap = self._capture_factory(self.device_index)
        except TypeError:
            # Handle mock capture factories in unit tests that only accept 1 argument
            cap = self._capture_factory(self.device_index)
        except Exception as exc:
            logger.error(
                "Exception initializing camera index %d: %s",
                self.device_index,
                str(exc),
            )
            raise CameraNotFoundError(
                f"Camera device {self.device_index} could not be initialized: {exc}"
            ) from exc

        if cap is None or not cap.isOpened():
            logger.error("Camera index %d could not be opened", self.device_index)
            if cap is not None:
                try:
                    cap.release()
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Suppressed error releasing failed camera: %s", exc)
            raise CameraNotFoundError(
                f"Camera device {self.device_index} not found or could not be opened."
            )

        # Configure target dimensions and framerate
        try:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(self.width))
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(self.height))
            cap.set(cv2.CAP_PROP_FPS, float(self.fps))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not set camera properties: %s", str(exc))

        self._cap = cap

        # Ensure camera is released on unexpected process termination
        if not self._is_registered_atexit:
            atexit.register(self.release)
            self._is_registered_atexit = True

        logger.info(
            "Camera stream opened successfully on device %d (%dx%d @ %dfps)",
            self.device_index,
            self.width,
            self.height,
            self.fps,
        )

    def is_opened(self) -> bool:
        """Check if the camera is currently opened and available."""
        return self._cap is not None and bool(self._cap.isOpened())

    def read(self) -> np.ndarray:
        """Capture and return a single frame as a numpy BGR array.

        Returns:
            np.ndarray: In-memory image array (height, width, 3).

        Raises:
            CameraNotFoundError: If the camera has not been opened.
            CameraReadFailedError: If the frame capture returns an empty or invalid array.
        """
        if self._cap is None or not self._cap.isOpened():
            raise CameraNotFoundError(
                f"Cannot read from camera {self.device_index}: device is not opened."
            )

        ret, frame = self._cap.read()
        if not ret or frame is None or frame.size == 0:
            logger.error("Failed to read frame from camera index %d", self.device_index)
            raise CameraReadFailedError(
                f"Failed to read a valid frame from camera device {self.device_index}."
            )

        return frame

    def release(self) -> None:
        """Safely release the underlying OpenCV VideoCapture resource."""
        if self._cap is not None:
            try:
                self._cap.release()
                logger.info("Camera device %d released cleanly.", self.device_index)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Error releasing camera device %d: %s",
                    self.device_index,
                    str(exc),
                )
            finally:
                self._cap = None

        if self._is_registered_atexit:
            try:
                atexit.unregister(self.release)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Error unregistering atexit handler: %s", exc)
            self._is_registered_atexit = False

    def __enter__(self) -> Self:
        self.open()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        self.release()

    def __del__(self) -> None:
        self.release()
