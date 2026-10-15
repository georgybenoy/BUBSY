"""Temporal sliding window validation for handwashing gesture predictions.

Implements bounded temporal filtering per PRD section 7.3 (FR-AI-05, FR-AI-06, FR-AI-08, FR-AI-09)
and section 10.4.

Evaluates a bounded sliding history of predictions to suppress transient errors,
flicker, and isolated detection spikes.

PURE, deterministic Python: zero OpenCV, YOLO, FastAPI, or DB imports.
"""

from collections import deque
from dataclasses import dataclass
from enum import Enum

from app.vision.gestures import GestureClass, normalize_gesture_label


class TemporalStatus(str, Enum):
    """Temporal validation status for a target gesture in the sliding window."""

    SUPPORTED = "SUPPORTED"
    UNCERTAIN = "UNCERTAIN"
    NOT_PRESENT = "NOT_PRESENT"


@dataclass(frozen=True)
class PredictionSample:
    """A single gesture prediction sample with timestamp and confidence."""

    timestamp_ms: float
    label: GestureClass
    confidence: float


@dataclass(frozen=True)
class TemporalConfig:
    """Configurable thresholds for temporal window validation."""

    window_duration_ms: float = 2000.0
    min_confidence: float = 0.60
    min_persistence_ms: float = 800.0
    min_agreement_ratio: float = 0.65
    spike_persistence_ms: float = 150.0
    spike_ratio_threshold: float = 0.20
    uncertain_confidence_threshold: float = 0.35
    uncertain_ratio_threshold: float = 0.30
    max_buffer_size: int = 200


@dataclass(frozen=True)
class TemporalEvaluationResult:
    """Structured evaluation of target gesture presence within the temporal window."""

    status: TemporalStatus
    target_gesture: GestureClass
    total_frames: int
    agreeing_frames: int
    agreement_ratio: float
    persistence_ms: float
    mean_confidence: float
    details: str = ""


class TemporalSlidingWindow:
    """Bounded sliding window of predictions evaluated against temporal criteria.

    Suppresses isolated spikes, checks persistence across time, and enforces
    agreement proportion thresholds.
    """

    def __init__(self, config: TemporalConfig | None = None) -> None:
        self.config = config or TemporalConfig()
        self._buffer: deque[PredictionSample] = deque(
            maxlen=self.config.max_buffer_size
        )

    @property
    def sample_count(self) -> int:
        """Return the current number of samples retained in the buffer."""
        return len(self._buffer)

    def clear(self) -> None:
        """Clear all buffered prediction samples."""
        self._buffer.clear()

    def add_prediction(
        self,
        timestamp_ms: float,
        label: GestureClass | str,
        confidence: float,
    ) -> None:
        """Append a new prediction sample to the bounded sliding window.

        Prunes samples older than the configured window duration.
        """
        normalized_label = (
            label if isinstance(label, GestureClass) else normalize_gesture_label(label)
        )
        clamped_conf = max(0.0, min(1.0, float(confidence)))
        sample = PredictionSample(
            timestamp_ms=float(timestamp_ms),
            label=normalized_label,
            confidence=clamped_conf,
        )

        self._buffer.append(sample)
        self._prune(sample.timestamp_ms)

    def _prune(self, current_time_ms: float) -> None:
        """Evict samples older than window_duration_ms relative to current_time_ms."""
        cutoff = current_time_ms - self.config.window_duration_ms
        while self._buffer and self._buffer[0].timestamp_ms < cutoff:
            self._buffer.popleft()

    def get_samples(self) -> list[PredictionSample]:
        """Return an immutable snapshot of current samples in the window."""
        return list(self._buffer)

    def evaluate(
        self,
        target_gesture: GestureClass | str,
        current_time_ms: float | None = None,
    ) -> TemporalEvaluationResult:
        """Evaluate whether the target gesture is SUPPORTED, UNCERTAIN, or NOT_PRESENT.

        Criteria:
        - SUPPORTED:
          1. Persistence ms >= min_persistence_ms
          2. Agreement ratio >= min_agreement_ratio
          3. Mean confidence >= min_confidence
        - UNCERTAIN:
          Movement detected above isolated-spike threshold, but failing one or
          more supported thresholds while meeting uncertainty minimums.
        - NOT_PRESENT:
          Zero agreeing frames, or an isolated spike (tiny duration/ratio).
        """
        normalized_target = (
            target_gesture
            if isinstance(target_gesture, GestureClass)
            else normalize_gesture_label(target_gesture)
        )

        if not self._buffer:
            return TemporalEvaluationResult(
                status=TemporalStatus.NOT_PRESENT,
                target_gesture=normalized_target,
                total_frames=0,
                agreeing_frames=0,
                agreement_ratio=0.0,
                persistence_ms=0.0,
                mean_confidence=0.0,
                details="Buffer is empty",
            )

        eval_time = (
            float(current_time_ms)
            if current_time_ms is not None
            else self._buffer[-1].timestamp_ms
        )
        self._prune(eval_time)

        total_frames = len(self._buffer)
        if total_frames == 0:
            return TemporalEvaluationResult(
                status=TemporalStatus.NOT_PRESENT,
                target_gesture=normalized_target,
                total_frames=0,
                agreeing_frames=0,
                agreement_ratio=0.0,
                persistence_ms=0.0,
                mean_confidence=0.0,
                details="All samples pruned past window cutoff",
            )

        agreeing: list[PredictionSample] = [
            s for s in self._buffer if s.label == normalized_target
        ]
        agreeing_count = len(agreeing)

        if agreeing_count == 0:
            return TemporalEvaluationResult(
                status=TemporalStatus.NOT_PRESENT,
                target_gesture=normalized_target,
                total_frames=total_frames,
                agreeing_frames=0,
                agreement_ratio=0.0,
                persistence_ms=0.0,
                mean_confidence=0.0,
                details="No matching frames in window",
            )

        agreement_ratio = agreeing_count / total_frames
        persistence_ms = agreeing[-1].timestamp_ms - agreeing[0].timestamp_ms
        mean_confidence = sum(s.confidence for s in agreeing) / agreeing_count

        # Check for isolated spike:
        # e.g., 1 or 2 frames lasting < spike_persistence_ms with low agreement ratio
        is_isolated_spike = (
            persistence_ms < self.config.spike_persistence_ms
            and agreement_ratio < self.config.spike_ratio_threshold
        )
        if is_isolated_spike:
            return TemporalEvaluationResult(
                status=TemporalStatus.NOT_PRESENT,
                target_gesture=normalized_target,
                total_frames=total_frames,
                agreeing_frames=agreeing_count,
                agreement_ratio=round(agreement_ratio, 3),
                persistence_ms=round(persistence_ms, 1),
                mean_confidence=round(mean_confidence, 3),
                details=f"Isolated spike ignored (persistence={persistence_ms:.1f}ms, ratio={agreement_ratio:.2f})",
            )

        # Check for SUPPORTED
        is_supported = (
            agreement_ratio >= self.config.min_agreement_ratio
            and persistence_ms >= self.config.min_persistence_ms
            and mean_confidence >= self.config.min_confidence
        )
        if is_supported:
            return TemporalEvaluationResult(
                status=TemporalStatus.SUPPORTED,
                target_gesture=normalized_target,
                total_frames=total_frames,
                agreeing_frames=agreeing_count,
                agreement_ratio=round(agreement_ratio, 3),
                persistence_ms=round(persistence_ms, 1),
                mean_confidence=round(mean_confidence, 3),
                details="Supported by sustained predictions and confidence",
            )

        # Check for UNCERTAIN:
        # Movement is present and above spike threshold, but either ratio,
        # persistence, or confidence is borderline.
        is_uncertain = (
            (
                mean_confidence >= self.config.uncertain_confidence_threshold
                and agreement_ratio >= self.config.uncertain_ratio_threshold
            )
            or (
                # Target is clearly dominant or persistent, but confidence is slightly below threshold
                agreement_ratio >= self.config.min_agreement_ratio
                and mean_confidence >= self.config.uncertain_confidence_threshold
            )
            or (
                # High confidence but student hasn't rubbed long enough yet
                mean_confidence >= self.config.min_confidence
                and persistence_ms > self.config.spike_persistence_ms
            )
        )

        if is_uncertain:
            reasons = []
            if mean_confidence < self.config.min_confidence:
                reasons.append(
                    f"confidence {mean_confidence:.2f} < {self.config.min_confidence:.2f}"
                )
            if persistence_ms < self.config.min_persistence_ms:
                reasons.append(
                    f"persistence {persistence_ms:.1f}ms < {self.config.min_persistence_ms:.1f}ms"
                )
            if agreement_ratio < self.config.min_agreement_ratio:
                reasons.append(
                    f"ratio {agreement_ratio:.2f} < {self.config.min_agreement_ratio:.2f}"
                )

            return TemporalEvaluationResult(
                status=TemporalStatus.UNCERTAIN,
                target_gesture=normalized_target,
                total_frames=total_frames,
                agreeing_frames=agreeing_count,
                agreement_ratio=round(agreement_ratio, 3),
                persistence_ms=round(persistence_ms, 1),
                mean_confidence=round(mean_confidence, 3),
                details=f"Uncertain evidence: {', '.join(reasons)}",
            )

        # Fallback if below uncertainty floor
        return TemporalEvaluationResult(
            status=TemporalStatus.NOT_PRESENT,
            target_gesture=normalized_target,
            total_frames=total_frames,
            agreeing_frames=agreeing_count,
            agreement_ratio=round(agreement_ratio, 3),
            persistence_ms=round(persistence_ms, 1),
            mean_confidence=round(mean_confidence, 3),
            details="Gesture presence below temporal and confidence thresholds",
        )
