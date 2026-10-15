"""Vision runner service coordinating camera capture, QR detection, and gesture inference.

Per PRD section 7.1 (FR-ID-10), section 7.3, and Phase 7 specifications:
- Mutually exclusive camera modes: IDENTIFY (QR scanning) and WASH (gesture recognition).
- Switching releases and reacquires camera cleanly.
- Background thread isolation: capture and inference run decoupled from scoring and DB transactions.
- QR scanning throttled and debounced to prevent duplicate identification events.
- Feeds predictions to TemporalSlidingWindow and SessionEngine.
- Emits child-safe events (no raw confidences or frames).
- Strictly in-memory frames: zero disk writes.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from enum import Enum
from typing import TYPE_CHECKING, Any

import cv2

from app.core.logging import logger
from app.vision.camera import WebcamCapture
from app.vision.gestures import GestureClass
from app.vision.inference import GestureModel, StubGestureModel
from app.vision.temporal import TemporalConfig, TemporalSlidingWindow, TemporalStatus

if TYPE_CHECKING:
    from app.services.session_engine import SessionEngine


class CameraMode(str, Enum):
    """Mutually exclusive camera operating modes per FR-ID-10."""

    IDLE = "IDLE"
    IDENTIFY = "IDENTIFY"
    WASH = "WASH"


class VisionRunner:
    """Coordinates camera capture, mode switching, and real-time inference loop."""

    def __init__(
        self,
        camera: WebcamCapture | None = None,
        model: GestureModel | None = None,
        camera_factory: Callable[[], WebcamCapture] | None = None,
        debounce_seconds: float = 3.0,
        throttle_ms: float = 200.0,
    ) -> None:
        self._camera_factory = camera_factory or (
            lambda: camera or WebcamCapture(device_index=0)
        )
        self._active_camera: WebcamCapture | None = camera
        self._model: GestureModel = model or StubGestureModel(model_version="1.0.0")
        self._mode = CameraMode.IDLE
        self._lock = threading.RLock()

        # Thread management
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        # IDENTIFY mode state
        self._qr_detector = cv2.QRCodeDetector()
        self._debounce_seconds = debounce_seconds
        self._throttle_ms = throttle_ms
        self._last_scan_time = 0.0
        self._last_scanned_token: str | None = None
        self._on_qr_detected: Callable[[str], None] | None = None

        # WASH mode state
        self._active_session: SessionEngine | None = None
        self._temporal_window = TemporalSlidingWindow(TemporalConfig())
        self._on_progress: Callable[[dict[str, Any]], None] | None = None
        self._last_seen_ooo = 0

        # Diagnostics & Metrics
        self._frame_count = 0
        self._last_fps = 0.0
        self._recent_errors: list[dict[str, Any]] = []

    @property
    def current_mode(self) -> CameraMode:
        """Return the current camera operating mode."""
        with self._lock:
            return self._mode

    @property
    def is_running(self) -> bool:
        """Return True if background capture thread is actively running."""
        return self._thread is not None and self._thread.is_alive()

    def set_qr_callback(self, callback: Callable[[str], None] | None) -> None:
        """Set callback invoked when a valid, debounced QR code is decoded in IDENTIFY mode."""
        with self._lock:
            self._on_qr_detected = callback

    def set_progress_callback(
        self, callback: Callable[[dict[str, Any]], None] | None
    ) -> None:
        """Set callback invoked with child-safe events in WASH mode."""
        with self._lock:
            self._on_progress = callback

    def attach_session(self, session: SessionEngine) -> None:
        """Attach an active SessionEngine and reset temporal state for WASH mode."""
        with self._lock:
            self._active_session = session
            self._temporal_window.clear()
            self._last_seen_ooo = session.out_of_order_count

    def detach_session(self) -> None:
        """Detach active SessionEngine upon completion or cancellation."""
        with self._lock:
            self._active_session = None
            self._temporal_window.clear()

    def set_mode(self, new_mode: CameraMode) -> None:
        """Switch camera mode, cleanly releasing and reacquiring hardware per FR-ID-10."""
        with self._lock:
            if self._mode == new_mode:
                return

            logger.info(
                "Switching camera mode: %s -> %s", self._mode.value, new_mode.value
            )
            self._stop_background_thread()

            self._mode = new_mode

            if new_mode != CameraMode.IDLE:
                self._start_background_thread()

    def _start_background_thread(self) -> None:
        """Acquire camera and start processing thread."""
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name=f"VisionRunner-{self._mode.value}",
            daemon=True,
        )
        self._thread.start()

    def _stop_background_thread(self) -> None:
        """Signal stop and wait for loop to exit and release camera."""
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self._thread.join(timeout=2.0)
            self._thread = None

        if self._active_camera and self._active_camera.is_opened():
            try:
                self._active_camera.release()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error releasing camera during mode switch: %s", exc)
            finally:
                self._active_camera = None

    def _run_loop(self) -> None:
        """Main camera acquisition and processing loop."""
        mode = self._mode
        logger.info("Camera processing loop started in %s mode", mode.value)

        camera: WebcamCapture | None = None
        try:
            with self._lock:
                camera = self._camera_factory()
                self._active_camera = camera
                camera.open()

            last_tick = time.time()
            fps_frame_counter = 0
            fps_start_time = time.time()

            consecutive_read_failures = 0
            while not self._stop_event.is_set():
                now = time.time()
                frame_delta_ms = max(1.0, (now - last_tick) * 1000.0)
                last_tick = now

                # 1. Acquire frame with tolerance for temporary glitch
                try:
                    frame = camera.read()
                    consecutive_read_failures = 0
                except Exception as read_exc:
                    consecutive_read_failures += 1
                    if consecutive_read_failures <= 10:
                        time.sleep(0.04)
                        continue
                    raise read_exc

                fps_frame_counter += 1
                if now - fps_start_time >= 1.0:
                    self._last_fps = fps_frame_counter / (now - fps_start_time)
                    fps_frame_counter = 0
                    fps_start_time = now

                # 2. Process according to active mode
                if mode == CameraMode.IDENTIFY:
                    self._process_identify_frame(frame, now)
                elif mode == CameraMode.WASH:
                    self._process_wash_frame(frame, now * 1000.0, frame_delta_ms)

                # Frame reference discarded naturally (in-memory only)
                del frame

                # Small sleep to yield CPU if camera doesn't block
                time.sleep(0.005)

        except Exception as exc:  # noqa: BLE001
            logger.error("VisionRunner loop error in %s mode: %s", mode.value, exc)
            with self._lock:
                self._recent_errors.append(
                    {
                        "timestamp": time.time(),
                        "mode": mode.value,
                        "error": str(exc),
                    }
                )
        finally:
            if camera and camera.is_opened():
                try:
                    camera.release()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Error releasing camera in loop cleanup: %s", exc)
            with self._lock:
                self._active_camera = None
            logger.info("Camera processing loop exited for %s mode", mode.value)

    def _process_identify_frame(self, frame: Any, current_time: float) -> None:
        """Execute QR detection and debounced callback in IDENTIFY mode."""
        # Throttle detector execution to limit CPU use
        if (current_time - self._last_scan_time) * 1000.0 < self._throttle_ms:
            return

        try:
            # OpenCV QRCodeDetector
            decoded_info, _bbox, _ = self._qr_detector.detectAndDecode(frame)
            if decoded_info:
                token = decoded_info.strip()
                if not token:
                    return

                # Debounce repeated scans of the same token
                if (
                    token == self._last_scanned_token
                    and (current_time - self._last_scan_time) < self._debounce_seconds
                ):
                    return

                self._last_scanned_token = token
                self._last_scan_time = current_time
                logger.info(
                    "QR code successfully detected in IDENTIFY mode (length=%d)",
                    len(token),
                )

                if self._on_qr_detected:
                    self._on_qr_detected(token)
        except Exception as exc:  # noqa: BLE001
            logger.debug("QR decoding exception: %s", exc)

    def _process_wash_frame(
        self, frame: Any, current_ms: float, frame_delta_ms: float
    ) -> None:
        """Execute gesture inference, temporal filtering, and session advancement in WASH mode."""
        with self._lock:
            session = self._active_session

        if not session:
            return

        state_val = getattr(session.state, "value", str(session.state))
        if state_val != "in_progress":
            return

        step = session.current_step
        if not step:
            return

        # 1. Run gesture inference
        pred = self._model.predict(frame)

        # 2. Feed prediction into temporal validator
        self._temporal_window.add_prediction(
            timestamp_ms=current_ms,
            label=pred.label,
            confidence=pred.confidence,
        )

        step_code = step.step_code
        seq_idx = step.sequence_index
        total_steps = len(session.protocol.steps)

        # 3. Instructed step vs AI-verified step
        if not step.is_ai_verified:
            # Instructed step (PREPARATION, RINSE, DRY) - broadcast prompt
            if self._on_progress:
                self._on_progress(
                    {
                        "session_id": session.session_id,
                        "step_code": step_code,
                        "sequence_index": seq_idx,
                        "step_number": seq_idx + 1,
                        "total_steps": total_steps,
                        "step_name": step.name,
                        "prompt_text": step.prompt_text,
                        "status_hint": "INSTRUCTED_STEP",
                        "progress_ratio": 1.0,
                        "is_verified_step": False,
                        "is_completed": False,
                    }
                )
            return

        # 4. Evaluate temporal evidence for active rubbing step
        target_gesture = step.target_gesture or GestureClass.UNKNOWN
        temp_result = self._temporal_window.evaluate(target_gesture, current_ms)

        # 5. Feed into SessionEngine
        step_event = session.process_gesture_evidence(
            temp_result, current_ms, frame_delta_ms
        )

        # 6. Compute child-safe status hint (No raw confidence sent!)
        status_hint = "GREAT_START"
        if step_event and step_event.result == "recognized":
            status_hint = "STEP_COMPLETED"
        elif step_event and step_event.result == "retry":
            status_hint = "RETRY"
        elif temp_result.status == TemporalStatus.SUPPORTED:
            status_hint = "KEEP_RUBBING"
        elif session.out_of_order_count > self._last_seen_ooo:
            self._last_seen_ooo = session.out_of_order_count
            status_hint = "TRY_CURRENT_STEP"
        elif temp_result.status == TemporalStatus.UNCERTAIN:
            status_hint = "HOLD_HANDS_CLEARLY"

        duration_progress = min(
            1.0,
            session._current_step_duration_ms / max(1.0, float(step.min_duration_ms)),
        )

        is_completed = (
            getattr(session.state, "value", str(session.state)) == "completed"
        )

        if self._on_progress:
            self._on_progress(
                {
                    "session_id": session.session_id,
                    "step_code": step_code,
                    "sequence_index": seq_idx,
                    "step_number": seq_idx + 1,
                    "total_steps": total_steps,
                    "step_name": step.name,
                    "prompt_text": step.prompt_text,
                    "status_hint": status_hint,
                    "progress_ratio": round(duration_progress, 2),
                    "is_verified_step": True,
                    "is_completed": is_completed,
                }
            )

    def get_diagnostics(self) -> dict[str, Any]:
        """Return real-time hardware and inference diagnostics for system status."""
        with self._lock:
            cam_opened = (
                self._active_camera is not None and self._active_camera.is_opened()
            )
            return {
                "camera": {
                    "status": "connected"
                    if cam_opened
                    else ("idle" if self._mode == CameraMode.IDLE else "disconnected"),
                    "mode": self._mode.value,
                    "fps": round(self._last_fps, 1),
                    "is_running": self.is_running,
                },
                "recognition_service": {
                    "status": "ready" if self._model else "uninitialized",
                    "model_version": self._model.model_version
                    if self._model
                    else "unknown",
                },
                "qr_scanner": {
                    "status": "active"
                    if self._mode == CameraMode.IDENTIFY
                    else "standby",
                    "throttle_ms": self._throttle_ms,
                    "debounce_seconds": self._debounce_seconds,
                },
                "recent_errors": list(self._recent_errors[-10:]),
            }

    def close(self) -> None:
        """Clean shutdown releasing camera hardware."""
        self.set_mode(CameraMode.IDLE)
