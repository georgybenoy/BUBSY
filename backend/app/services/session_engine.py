"""Handwashing session state machine and sequence validation engine.

Implements session lifecycle and sequence tracking per PRD section 7.3 (FR-AI-07,
FR-AI-08, FR-AI-09), section 7.4 (FR-SES-01 to FR-SES-06), section 10.4, and
TESTING.md section 3.

Key behaviors:
- Protocol loaded from versioned configuration (preparation, six rubbing steps, rinse, dry).
- Target durations and minimum requirements are configurable, not hardcoded.
- One event cannot advance more than one step.
- Out-of-order gestures do not advance; they are recorded as out_of_order.
- Uncertain evidence retains current step and emits a RETRY hint rather than failing.
- Inactivity timeout abandons the session cleanly.
- Preparation, rinse, and dry steps are marked as instructed, NOT as verified.
- Emits structured session events matching session_steps schema.

PURE, deterministic Python: zero OpenCV, YOLO, FastAPI, or DB imports.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal

from app.vision.gestures import GestureClass
from app.vision.temporal import TemporalEvaluationResult, TemporalStatus


class SessionState(str, Enum):
    """Session lifecycle states."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    INTERRUPTED = "interrupted"


class SessionEngineError(Exception):
    """Base exception for session state machine violations."""


class IllegalStateTransitionError(SessionEngineError):
    """Raised when an invalid state transition is attempted."""


class SessionInactiveError(SessionEngineError):
    """Raised when an operation is attempted on an inactive (completed/abandoned/interrupted) session."""


StepResultType = Literal["recognized", "retry", "uncertain", "skipped"]


@dataclass(frozen=True)
class ProtocolStepConfig:
    """Configuration for a single step in a versioned handwashing protocol."""

    step_code: str
    sequence_index: int
    name: str
    target_gesture: GestureClass | None
    is_ai_verified: bool
    target_duration_ms: int = 5000
    min_duration_ms: int = 3000
    prompt_text: str = ""


@dataclass(frozen=True)
class ProtocolConfig:
    """Versioned handwashing protocol configuration."""

    protocol_version: str = "1.0.0"
    inactivity_timeout_ms: int = 30000
    steps: tuple[ProtocolStepConfig, ...] = ()

    @property
    def total_steps(self) -> int:
        return len(self.steps)

    @property
    def ai_verified_steps_count(self) -> int:
        return sum(1 for step in self.steps if step.is_ai_verified)


def get_default_protocol_config(version: str = "1.0.0") -> ProtocolConfig:
    """Return standard WHO 6-step rubbing protocol + preparation, rinse, and dry."""
    steps = (
        # 0. Preparation: Soap & Water (Instructed only, not AI-verified)
        ProtocolStepConfig(
            step_code="PREPARATION",
            sequence_index=0,
            name="Wet hands and apply soap",
            target_gesture=None,
            is_ai_verified=False,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Wet your hands with clean water and apply soap.",
        ),
        # 1. Palm-to-palm
        ProtocolStepConfig(
            step_code="PALM_TO_PALM",
            sequence_index=1,
            name="Palm to palm",
            target_gesture=GestureClass.PALM_TO_PALM,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Rub hands palm to palm.",
        ),
        # 2. Right palm over left dorsum and vice versa
        ProtocolStepConfig(
            step_code="PALM_OVER_DORSUM",
            sequence_index=2,
            name="Palm over back of hand",
            target_gesture=GestureClass.PALM_OVER_DORSUM,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Right palm over left back of hand with fingers interlaced, and vice versa.",
        ),
        # 3. Palm to palm with fingers interlaced
        ProtocolStepConfig(
            step_code="FINGERS_INTERLACED",
            sequence_index=3,
            name="Fingers interlaced",
            target_gesture=GestureClass.FINGERS_INTERLACED,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Palm to palm with fingers interlaced.",
        ),
        # 4. Backs of fingers against opposing palms
        ProtocolStepConfig(
            step_code="BACKS_OF_FINGERS",
            sequence_index=4,
            name="Backs of fingers",
            target_gesture=GestureClass.BACKS_OF_FINGERS,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Backs of fingers to opposing palms with fingers interlocked.",
        ),
        # 5. Rotational rubbing of each thumb
        ProtocolStepConfig(
            step_code="THUMB_RUBBING",
            sequence_index=5,
            name="Thumb rubbing",
            target_gesture=GestureClass.THUMB_RUBBING,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Rotational rubbing of each thumb clasped in opposing palm.",
        ),
        # 6. Rotational rubbing of fingertips against opposing palms
        ProtocolStepConfig(
            step_code="FINGERTIPS",
            sequence_index=6,
            name="Fingertips in palms",
            target_gesture=GestureClass.FINGERTIPS,
            is_ai_verified=True,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Rotational rubbing of fingertips and fingernails in palms.",
        ),
        # 7. Rinse: Water rinse (Instructed only, not AI-verified)
        ProtocolStepConfig(
            step_code="RINSE",
            sequence_index=7,
            name="Rinse hands",
            target_gesture=None,
            is_ai_verified=False,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Rinse hands thoroughly with running water.",
        ),
        # 8. Dry: Towel dry (Instructed only, not AI-verified)
        ProtocolStepConfig(
            step_code="DRY",
            sequence_index=8,
            name="Dry hands",
            target_gesture=None,
            is_ai_verified=False,
            target_duration_ms=5000,
            min_duration_ms=3000,
            prompt_text="Dry hands thoroughly with a clean towel.",
        ),
    )
    return ProtocolConfig(
        protocol_version=version,
        inactivity_timeout_ms=30000,
        steps=steps,
    )


@dataclass(frozen=True)
class SessionStepEvent:
    """Structured session step event matching session_steps schema requirements."""

    step_code: str
    sequence_index: int
    result: StepResultType
    duration_ms: int
    confidence_summary: float | None
    is_verified: bool
    hint: str | None = None
    notes: str | None = None
    timestamp_ms: float = 0.0


@dataclass
class SessionEngine:
    """State machine managing active handwashing guidance sessions.

    Enforces temporal validity, single-step advance invariant, out-of-order
    detection, inactivity timeout, and clear distinction between instructed
    versus verified steps.
    """

    session_id: str
    student_id: str | None = None
    kiosk_id: str = "kiosk-1"
    protocol: ProtocolConfig = field(default_factory=get_default_protocol_config)
    start_time_ms: float = 0.0

    # Dynamic state
    state: SessionState = SessionState.IN_PROGRESS
    current_step_index: int = 0
    failure_reason: str | None = None

    # Internal timing & tracking
    _last_activity_time_ms: float = field(init=False)
    _current_step_duration_ms: float = field(init=False, default=0.0)
    _current_step_confidences: list[float] = field(init=False, default_factory=list)
    _events: list[SessionStepEvent] = field(init=False, default_factory=list)
    _out_of_order_count: int = field(init=False, default=0)
    _out_of_order_log: list[dict[str, Any]] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        self._last_activity_time_ms = self.start_time_ms
        if not self.protocol.steps:
            raise SessionEngineError(
                "Protocol must contain at least one step configuration."
            )

    @property
    def is_unassigned(self) -> bool:
        """True if session is anonymous/unassigned to a registered student."""
        return self.student_id is None

    @property
    def current_step(self) -> ProtocolStepConfig | None:
        """Return currently active protocol step config or None if session completed."""
        if self.current_step_index < len(self.protocol.steps):
            return self.protocol.steps[self.current_step_index]
        return None

    @property
    def out_of_order_count(self) -> int:
        """Count of observed out-of-order gesture transitions."""
        return self._out_of_order_count

    @property
    def step_events(self) -> list[SessionStepEvent]:
        """All recorded step events in sequence order."""
        return list(self._events)

    def check_inactivity(self, current_time_ms: float) -> bool:
        """Check and transition to ABANDONED if inactivity timeout has elapsed."""
        if self.state != SessionState.IN_PROGRESS:
            return False

        elapsed = current_time_ms - self._last_activity_time_ms
        if elapsed > self.protocol.inactivity_timeout_ms:
            self.state = SessionState.ABANDONED
            self.failure_reason = "INACTIVITY_TIMEOUT"
            return True
        return False

    def advance_instructed_step(
        self,
        current_time_ms: float,
        duration_ms: int | None = None,
    ) -> SessionStepEvent:
        """Advance an instructed step (e.g. PREPARATION, RINSE, DRY).

        Privacy & Truth in AI rule:
        Preparation, rinse and dry steps are marked as instructed, NOT as verified.
        Confidence summary is strictly None.
        """
        self._ensure_active()
        if self.check_inactivity(current_time_ms):
            raise SessionInactiveError(
                "Session was abandoned due to inactivity timeout."
            )

        step = self.current_step
        if step is None:
            raise SessionInactiveError(
                "All protocol steps have already been completed."
            )

        if step.is_ai_verified:
            raise SessionEngineError(
                f"Step '{step.step_code}' requires AI gesture validation and cannot be completed via instructed advance."
            )

        self._last_activity_time_ms = current_time_ms
        step_duration = duration_ms or step.target_duration_ms

        event = SessionStepEvent(
            step_code=step.step_code,
            sequence_index=self.current_step_index,
            result="recognized",
            duration_ms=step_duration,
            confidence_summary=None,  # Not AI-verified!
            is_verified=False,  # Explicitly instructed only
            notes=f"Instructed step '{step.name}' marked complete",
            timestamp_ms=current_time_ms,
        )

        self._events.append(event)
        self._advance_one_step()
        return event

    def process_gesture_evidence(
        self,
        temporal_result: TemporalEvaluationResult,
        current_time_ms: float,
        frame_delta_ms: float = 33.3,
    ) -> SessionStepEvent | None:
        """Process incoming temporal window evaluation for the active step.

        Invariants:
        1. One event cannot advance more than one step.
        2. Out-of-order gestures do not advance; they are recorded as out_of_order.
        3. Uncertain evidence keeps current step and emits a RETRY hint.
        4. Inactivity timeout abandons session.
        """
        self._ensure_active()
        if self.check_inactivity(current_time_ms):
            raise SessionInactiveError(
                "Session was abandoned due to inactivity timeout."
            )

        step = self.current_step
        if step is None:
            raise SessionInactiveError("All protocol steps are completed.")

        # If current step is an instructed step, gestures do not advance it
        if not step.is_ai_verified:
            self._last_activity_time_ms = current_time_ms
            return None

        self._last_activity_time_ms = current_time_ms
        target_gesture = step.target_gesture

        # Case 1: Temporal status is SUPPORTED
        if temporal_result.status == TemporalStatus.SUPPORTED:
            if temporal_result.target_gesture == target_gesture:
                # Matching gesture detected
                self._current_step_duration_ms += max(0.0, float(frame_delta_ms))
                self._current_step_confidences.append(temporal_result.mean_confidence)

                # Check if minimum sustained duration requirement is met
                if self._current_step_duration_ms >= step.min_duration_ms:
                    avg_conf = sum(self._current_step_confidences) / len(
                        self._current_step_confidences
                    )
                    event = SessionStepEvent(
                        step_code=step.step_code,
                        sequence_index=self.current_step_index,
                        result="recognized",
                        duration_ms=int(self._current_step_duration_ms),
                        confidence_summary=round(avg_conf, 3),
                        is_verified=True,
                        notes=f"Verified technique for {step.name}",
                        timestamp_ms=current_time_ms,
                    )
                    self._events.append(event)
                    self._advance_one_step()
                    return event

                return None

            # Check if gesture corresponds to a different protocol step (out-of-order)
            is_another_protocol_gesture = any(
                s.target_gesture == temporal_result.target_gesture
                for s in self.protocol.steps
                if s.target_gesture is not None
            )
            if is_another_protocol_gesture:
                self._out_of_order_count += 1
                self._out_of_order_log.append(
                    {
                        "expected_step": step.step_code,
                        "observed_gesture": str(temporal_result.target_gesture),
                        "timestamp_ms": current_time_ms,
                        "sequence_index": self.current_step_index,
                    }
                )
                # DO NOT advance step!
                return None

            # Background/Idle or unhandled movement
            return None

        # Case 2: Temporal status is UNCERTAIN
        if temporal_result.status == TemporalStatus.UNCERTAIN:
            if temporal_result.target_gesture == target_gesture:
                # Emits supportive RETRY hint; DOES NOT advance or fail step
                hint_msg = f"Please keep hands clearly in camera view and continue rubbing: {step.name}."
                event = SessionStepEvent(
                    step_code=step.step_code,
                    sequence_index=self.current_step_index,
                    result="retry",
                    duration_ms=int(self._current_step_duration_ms),
                    confidence_summary=round(temporal_result.mean_confidence, 3),
                    is_verified=False,
                    hint=hint_msg,
                    notes=temporal_result.details,
                    timestamp_ms=current_time_ms,
                )
                # Record as an event observation, but keep step active
                self._events.append(event)
                return event

            return None

        # Case 3: NOT_PRESENT
        return None

    def skip_step(
        self,
        current_time_ms: float,
        reason: str = "skipped_by_user",
    ) -> SessionStepEvent:
        """Skip current active step (marks as skipped and advances one step)."""
        self._ensure_active()
        if self.check_inactivity(current_time_ms):
            raise SessionInactiveError(
                "Session was abandoned due to inactivity timeout."
            )

        step = self.current_step
        if step is None:
            raise SessionInactiveError("All steps already completed.")

        self._last_activity_time_ms = current_time_ms
        event = SessionStepEvent(
            step_code=step.step_code,
            sequence_index=self.current_step_index,
            result="skipped",
            duration_ms=int(self._current_step_duration_ms),
            confidence_summary=None,
            is_verified=False,
            notes=f"Step skipped: {reason}",
            timestamp_ms=current_time_ms,
        )

        self._events.append(event)
        self._advance_one_step()
        return event

    def interrupt(
        self,
        reason: str = "INTERRUPTED_BY_USER",
        timestamp_ms: float | None = None,
    ) -> None:
        """Mark session as interrupted."""
        if self.state in (SessionState.COMPLETED, SessionState.ABANDONED):
            raise IllegalStateTransitionError(
                f"Cannot interrupt a session that is already in '{self.state.value}' state."
            )

        self.state = SessionState.INTERRUPTED
        self.failure_reason = reason
        if timestamp_ms is not None:
            self._last_activity_time_ms = timestamp_ms

    def abandon(
        self,
        reason: str = "ABANDONED_BY_USER",
        timestamp_ms: float | None = None,
    ) -> None:
        """Mark session as abandoned."""
        if self.state == SessionState.COMPLETED:
            raise IllegalStateTransitionError(
                "Cannot abandon a session that has already successfully completed."
            )

        self.state = SessionState.ABANDONED
        self.failure_reason = reason
        if timestamp_ms is not None:
            self._last_activity_time_ms = timestamp_ms

    def _advance_one_step(self) -> None:
        """Advance step index by exactly 1 and reset step duration accumulator."""
        self.current_step_index += 1
        self._current_step_duration_ms = 0.0
        self._current_step_confidences.clear()

        if self.current_step_index >= len(self.protocol.steps):
            self.state = SessionState.COMPLETED

    def _ensure_active(self) -> None:
        """Validate that the session state allows modifications."""
        if self.state != SessionState.IN_PROGRESS:
            raise SessionInactiveError(
                f"Cannot process events on a session in '{self.state.value}' state."
            )

    def get_summary(self) -> dict[str, Any]:
        """Return structured session summary."""
        recognized_steps = [
            e.step_code for e in self._events if e.result == "recognized"
        ]
        return {
            "session_id": self.session_id,
            "student_id": self.student_id,
            "is_unassigned": self.is_unassigned,
            "kiosk_id": self.kiosk_id,
            "state": self.state.value,
            "protocol_version": self.protocol.protocol_version,
            "current_step_index": self.current_step_index,
            "total_protocol_steps": len(self.protocol.steps),
            "completed_steps_count": len(recognized_steps),
            "out_of_order_count": self._out_of_order_count,
            "out_of_order_log": list(self._out_of_order_log),
            "events_count": len(self._events),
            "failure_reason": self.failure_reason,
        }
