"""Service for inspecting, filtering, and diagnosing handwashing sessions."""

import math
import sqlite3
from typing import Any

from app.database.repositories.session_steps_repo import SessionStepsRepository
from app.database.repositories.sessions_repo import SessionsRepository

STEP_NAME_MAP = {
    "STEP_1": "Palm to Palm",
    "STEP_2": "Back of Hands",
    "STEP_3": "Interlaced Fingers",
    "STEP_4": "Interlocked Fingers",
    "STEP_5": "Thumbs",
    "STEP_6": "Fingertips",
    "PREPARATION": "Wet & Soap",
    "RINSE": "Rinse Hands",
    "DRY": "Dry Hands",
}

EXPECTED_STEPS = [
    {"step_code": "STEP_1", "step_name": "Palm to Palm", "target_duration_seconds": 3},
    {"step_code": "STEP_2", "step_name": "Back of Hands", "target_duration_seconds": 3},
    {
        "step_code": "STEP_3",
        "step_name": "Interlaced Fingers",
        "target_duration_seconds": 3,
    },
    {
        "step_code": "STEP_4",
        "step_name": "Interlocked Fingers",
        "target_duration_seconds": 3,
    },
    {"step_code": "STEP_5", "step_name": "Thumbs", "target_duration_seconds": 3},
    {"step_code": "STEP_6", "step_name": "Fingertips", "target_duration_seconds": 3},
]


def classify_outcome_category(
    outcome: str, qualifies_for_points: int, failure_reason: str | None
) -> str:
    """Classify session into 1 of 5 standard reporting outcomes per DESIGN.md section 3.5.

    Outcomes:
    - completed-qualifying
    - incomplete
    - recognition_uncertain
    - cancelled
    - device_failure
    """
    reason_upper = (failure_reason or "").upper()
    if outcome == "completed" and qualifies_for_points == 1:
        return "completed-qualifying"
    if outcome == "error" or any(
        w in reason_upper
        for w in ["CAMERA", "DEVICE", "DISCONNECT", "HARDWARE", "CRASH"]
    ):
        return "device_failure"
    if outcome == "uncertain" or "UNCERTAIN" in reason_upper:
        return "recognition_uncertain"
    if outcome == "cancelled":
        return "cancelled"
    return "incomplete"


def list_sessions_service(
    conn: sqlite3.Connection,
    page: int = 1,
    limit: int = 20,
    start_date: str | None = None,
    end_date: str | None = None,
    class_id: str | None = None,
    student_id: str | None = None,
    outcome: str | None = None,
    kiosk_id: str | None = None,
) -> dict[str, Any]:
    """List filtered sessions with pagination."""
    safe_page = max(1, page)
    safe_limit = min(max(1, limit), 100)
    offset = (safe_page - 1) * safe_limit

    total = SessionsRepository.count_filtered(
        conn,
        start_date=start_date,
        end_date=end_date,
        class_id=class_id,
        student_id=student_id,
        outcome=outcome,
        kiosk_id=kiosk_id,
    )
    raw_rows = SessionsRepository.list_filtered(
        conn,
        start_date=start_date,
        end_date=end_date,
        class_id=class_id,
        student_id=student_id,
        outcome=outcome,
        kiosk_id=kiosk_id,
        limit=safe_limit,
        offset=offset,
    )

    items = []
    for r in raw_rows:
        cat = classify_outcome_category(
            outcome=r["outcome"],
            qualifies_for_points=r["qualifies_for_points"],
            failure_reason=r["failure_reason"],
        )
        items.append(
            {
                "session_id": r["session_id"],
                "student_id": r["student_id"],
                "student_name": r["student_name"] or "Anonymous / Unassigned",
                "student_code": r["student_code"],
                "class_id": r["class_id"],
                "class_name": r["class_name"] or "Unassigned",
                "kiosk_id": r["kiosk_id"],
                "started_at": r["started_at"],
                "ended_at": r["ended_at"],
                "duration_seconds": r["duration_seconds"],
                "outcome": r["outcome"],
                "qualifies_for_points": bool(r["qualifies_for_points"]),
                "points_awarded": int(r["points_awarded"]),
                "failure_reason": r["failure_reason"],
                "recognized_steps_count": int(r["recognized_steps_count"]),
                "total_steps_count": int(r["total_steps_count"]),
                "outcome_category": cat,
            }
        )

    total_pages = math.ceil(total / safe_limit) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
        "total_pages": total_pages,
    }


def get_session_detail_service(
    conn: sqlite3.Connection,
    session_id: str,
) -> dict[str, Any] | None:
    """Fetch complete forensic audit for a session."""
    session = SessionsRepository.get_detailed_by_id(conn, session_id)
    if not session:
        return None

    steps_raw = SessionStepsRepository.list_by_session(conn, session_id)
    recognized_sequence = []
    uncertainty_reasons = []

    for s in steps_raw:
        step_name = STEP_NAME_MAP.get(s["step_code"], s["step_code"])
        recognized_sequence.append(
            {
                "session_step_id": s["session_step_id"],
                "step_code": s["step_code"],
                "step_name": step_name,
                "sequence_index": s["sequence_index"],
                "result": s["result"],
                "duration_ms": s["duration_ms"],
                "confidence_summary": s["confidence_summary"],
                "created_at": s["created_at"],
            }
        )
        if s["result"] in ("uncertain", "retry"):
            uncertainty_reasons.append(
                f"Step {s['sequence_index'] + 1} ({step_name}): movement confidence below threshold or unstable temporal persistence."
            )

    if session["failure_reason"]:
        uncertainty_reasons.append(f"Termination Note: {session['failure_reason']}")

    cat = classify_outcome_category(
        outcome=session["outcome"],
        qualifies_for_points=session["qualifies_for_points"],
        failure_reason=session["failure_reason"],
    )

    score_breakdown = {
        "qualifies": bool(session["qualifies_for_points"]),
        "points_awarded": int(session["points_awarded"]),
        "steps_recognized": int(session["recognized_steps_count"]),
        "total_protocol_steps": 6,
        "penalty_reasons": uncertainty_reasons,
    }

    return {
        "session_id": session["session_id"],
        "student_id": session["student_id"],
        "student_name": session["student_name"] or "Anonymous / Unassigned",
        "student_code": session["student_code"],
        "class_id": session["class_id"],
        "class_name": session["class_name"] or "Unassigned",
        "kiosk_id": session["kiosk_id"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        "duration_seconds": session["duration_seconds"],
        "outcome": session["outcome"],
        "qualifies_for_points": bool(session["qualifies_for_points"]),
        "points_awarded": int(session["points_awarded"]),
        "failure_reason": session["failure_reason"],
        "protocol_version": session["protocol_version"],
        "model_version": session["model_version"] or "bubsy-yolo-v1",
        "scoring_version": "1.0.0",
        "outcome_category": cat,
        "uncertainty_reasons": uncertainty_reasons,
        "expected_sequence": EXPECTED_STEPS,
        "recognized_sequence": recognized_sequence,
        "score_breakdown": score_breakdown,
    }
