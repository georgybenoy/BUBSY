"""Deterministic handwashing technique scoring engine.

Implements scoring rules per PRD section 7.5 (FR-SCORE-01 to FR-SCORE-10) and
section 11.1 (Base completion score S_base = (N_completed / N_expected) * 100, bounded 0-100).

Key behaviors:
- Deterministic: identical session inputs and scoring configuration produce exact same output.
- Bounded: score is strictly clamped to [0.0, 100.0].
- Documented deduction rules with detailed reason breakdowns.
- Tracks scoring_version.
- Insufficient evidence yields 'uncertain' or 'unverified' status; never an unjustified perfect score.

PURE, deterministic Python: zero OpenCV, YOLO, FastAPI, or DB imports.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from app.services.session_engine import SessionStepEvent


@dataclass(frozen=True)
class DeductionDetail:
    """Documented deduction applied to base technique score."""

    reason_code: str
    description: str
    deduction_points: float
    step_code: str | None = None


@dataclass(frozen=True)
class ScoringConfig:
    """Versioned configuration for technique scoring calculations."""

    scoring_version: str = "1.0.0"
    expected_scored_steps: int = 6
    target_step_duration_ms: int = 5000
    out_of_order_deduction: float = 5.0
    max_out_of_order_deduction: float = 20.0
    duration_shortfall_deduction: float = 5.0
    uncertain_step_deduction: float = 10.0
    min_qualifying_score: float = 70.0
    min_average_confidence: float = 0.60


@dataclass(frozen=True)
class TechniqueScoreResult:
    """Structured breakdown and final technique score."""

    base_score: float
    final_score: float
    scoring_version: str
    completed_steps: int
    expected_steps: int
    out_of_order_count: int
    is_uncertain: bool
    status: str
    deductions: list[DeductionDetail]
    total_deductions: float
    average_confidence: float | None
    explanation: str

    def to_dict(self) -> dict[str, Any]:
        """Convert score breakdown to a serializable dictionary."""
        return {
            "base_score": self.base_score,
            "final_score": self.final_score,
            "scoring_version": self.scoring_version,
            "completed_steps": self.completed_steps,
            "expected_steps": self.expected_steps,
            "out_of_order_count": self.out_of_order_count,
            "is_uncertain": self.is_uncertain,
            "status": self.status,
            "deductions": [
                {
                    "reason_code": d.reason_code,
                    "description": d.description,
                    "deduction_points": d.deduction_points,
                    "step_code": d.step_code,
                }
                for d in self.deductions
            ],
            "total_deductions": self.total_deductions,
            "average_confidence": self.average_confidence,
            "explanation": self.explanation,
        }


def compute_technique_score(
    events: Sequence[SessionStepEvent],
    out_of_order_count: int = 0,
    session_state: str = "completed",
    config: ScoringConfig | None = None,
) -> TechniqueScoreResult:
    """Calculate deterministic technique-completion score per PRD 11.1.

    Formula:
      S_base = (N_completed / N_expected) * 100
      S_final = clamp(S_base - total_deductions, 0, 100)
    """
    cfg = config or ScoringConfig()
    deductions: list[DeductionDetail] = []

    # Filter recognized AI-verified steps
    ai_completed = [e for e in events if e.result == "recognized" and e.is_verified]
    completed_count = min(len(ai_completed), cfg.expected_scored_steps)

    # Base score computation
    if cfg.expected_scored_steps > 0:
        base_score = (completed_count / cfg.expected_scored_steps) * 100.0
    else:
        base_score = 0.0
    base_score = max(0.0, min(100.0, round(base_score, 1)))

    # Deductions:
    # 1. Out-of-order sequence transitions
    if out_of_order_count > 0:
        ooo_pts = min(
            out_of_order_count * cfg.out_of_order_deduction,
            cfg.max_out_of_order_deduction,
        )
        deductions.append(
            DeductionDetail(
                reason_code="OUT_OF_ORDER_GESTURE",
                description=f"{out_of_order_count} sequence violation(s) detected",
                deduction_points=ooo_pts,
            )
        )

    # 2. Duration shortfall per recognized AI step
    for step_event in ai_completed:
        if step_event.duration_ms < cfg.target_step_duration_ms:
            deductions.append(
                DeductionDetail(
                    reason_code="DURATION_SHORTFALL",
                    description=(
                        f"Step '{step_event.step_code}' duration ({step_event.duration_ms}ms) "
                        f"under target ({cfg.target_step_duration_ms}ms)"
                    ),
                    deduction_points=cfg.duration_shortfall_deduction,
                    step_code=step_event.step_code,
                )
            )

    # 3. Uncertain step results
    uncertain_events = [e for e in events if e.result in ("uncertain", "retry")]
    if uncertain_events:
        unc_pts = min(len(uncertain_events) * cfg.uncertain_step_deduction, 20.0)
        deductions.append(
            DeductionDetail(
                reason_code="UNCERTAIN_EVIDENCE",
                description=f"{len(uncertain_events)} step(s) had uncertain recognition evidence",
                deduction_points=unc_pts,
            )
        )

    # Compute total deductions
    total_deductions = round(sum(d.deduction_points for d in deductions), 1)

    # Calculate raw final score bounded to [0.0, 100.0]
    final_score = max(0.0, min(100.0, base_score - total_deductions))
    final_score = round(final_score, 1)

    # Calculate average confidence for AI-verified steps
    confidences = [
        e.confidence_summary for e in ai_completed if e.confidence_summary is not None
    ]
    avg_confidence = (
        round(sum(confidences) / len(confidences), 3) if confidences else None
    )

    # Evaluate uncertainty / unverified status
    is_uncertain = False
    status = "verified"

    if session_state != "completed":
        is_uncertain = True
        status = "incomplete"
    elif completed_count < cfg.expected_scored_steps:
        is_uncertain = True
        status = "unverified"
    elif uncertain_events or (
        avg_confidence is not None and avg_confidence < cfg.min_average_confidence
    ):
        is_uncertain = True
        status = "uncertain"

    # PRD FR-SCORE-10: Insufficient evidence yields "uncertain/unverified",
    # never an unjustified perfect score.
    if is_uncertain and final_score >= 100.0:
        final_score = 85.0
        deductions.append(
            DeductionDetail(
                reason_code="INSUFFICIENT_EVIDENCE_CAP",
                description="Score capped due to unverified or uncertain completion evidence",
                deduction_points=15.0,
            )
        )
        total_deductions = round(sum(d.deduction_points for d in deductions), 1)

    explanation = (
        f"Base score: {base_score:.1f}% ({completed_count}/{cfg.expected_scored_steps} steps). "
        f"Deductions: -{total_deductions:.1f} pts across {len(deductions)} rule(s). "
        f"Final technique score: {final_score:.1f} ({status})."
    )

    return TechniqueScoreResult(
        base_score=base_score,
        final_score=final_score,
        scoring_version=cfg.scoring_version,
        completed_steps=completed_count,
        expected_steps=cfg.expected_scored_steps,
        out_of_order_count=out_of_order_count,
        is_uncertain=is_uncertain,
        status=status,
        deductions=deductions,
        total_deductions=total_deductions,
        average_confidence=avg_confidence,
        explanation=explanation,
    )
