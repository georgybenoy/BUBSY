"""Kiosk interaction API v1 routes and real-time WebSocket events.

Per PRD section 7.1, 7.3, 7.4, 7.5, and Phase 7 specifications:
- Minimal, privacy-compliant identification.
- Teacher-assisted identification fallback (no auto-assignment).
- Handwashing session lifecycle: start, get, idempotent complete, cancel.
- Real-time child-safe WebSocket events (strictly no raw frames or confidences).
"""

import asyncio
import sqlite3
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.api.deps import get_current_active_teacher, get_db
from app.core.logging import logger
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.settings_repo import SettingsRepository
from app.database.repositories.student_achievements_repo import (
    StudentAchievementsRepository,
)
from app.database.repositories.students_repo import StudentsRepository
from app.schemas.envelope import ResponseEnvelope
from app.schemas.kiosk import (
    KioskBadgeItem,
    KioskCompleteSessionResponse,
    KioskConfigResponse,
    KioskCreateSessionRequest,
    KioskIdentifyRequest,
    KioskIdentifyResponseData,
    KioskManualIdentifyRequest,
    KioskSessionResponse,
    KioskStudentProgressResponse,
)
from app.services.credential_service import CredentialService, CredentialServiceError
from app.services.kiosk_session_manager import (
    SessionAlreadyActiveError,
    UnassignedSessionsDisabledError,
    kiosk_session_manager,
)

router = APIRouter(prefix="/kiosk", tags=["Kiosk"])


@router.get("/config", response_model=ResponseEnvelope[KioskConfigResponse])
def get_kiosk_config(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskConfigResponse]:
    """Retrieve public kiosk operational settings."""
    allow_unassigned = (
        SettingsRepository.get(conn, "allow_unassigned_sessions", "true").lower()
        == "true"
    )
    max_retries = int(SettingsRepository.get(conn, "kiosk_id_max_retries", "3"))
    nfc_status = kiosk_session_manager.credential_reader.get_status()
    nfc_avail = (
        nfc_status.get("configured", False) and nfc_status.get("status") == "ready"
    )

    return ResponseEnvelope(
        data=KioskConfigResponse(
            kiosk_id="kiosk-1",
            allow_unassigned_sessions=allow_unassigned,
            nfc_available=nfc_avail,
            max_id_retries=max_retries,
            first_name_display_allowed=True,
        )
    )


@router.post("/identify", response_model=ResponseEnvelope[KioskIdentifyResponseData])
def identify_kiosk_student(
    payload: KioskIdentifyRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskIdentifyResponseData]:
    """Resolve a scanned QR code or tapped NFC card for a kiosk session.

    Enforces retry thresholds and flags when teacher assistance is required.
    Never guesses or automatically selects an unverified student identity.
    """
    try:
        resolved = CredentialService.resolve(
            conn=conn,
            credential_type=payload.credential_type,
            raw_value=payload.raw_value,
        )
        kiosk_session_manager.reset_failed_identification()
    except CredentialServiceError as exc:
        retries, assistance_needed = kiosk_session_manager.record_failed_identification(
            conn
        )
        status_code = (
            status.HTTP_404_NOT_FOUND
            if exc.code == "CREDENTIAL_NOT_FOUND"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail={
                "code": exc.code,
                "message": exc.message,
                "retry_count": retries,
                "teacher_assistance_required": assistance_needed,
            },
        ) from exc

    full_name = resolved["display_name"]
    clean_name = full_name.replace("[DEMO]", "").strip() if full_name else ""
    first_name = clean_name.split()[0] if clean_name else (full_name.split()[0] if full_name else None)

    return ResponseEnvelope(
        data=KioskIdentifyResponseData(
            student_id=resolved["student_id"],
            display_handle=first_name or "Handwasher",
            first_name=first_name,
            retry_count=0,
            teacher_assistance_required=False,
        )
    )


@router.post(
    "/identify/manual", response_model=ResponseEnvelope[KioskIdentifyResponseData]
)
def manual_identify_student(
    payload: KioskManualIdentifyRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[KioskIdentifyResponseData]:
    """Teacher-assisted student identification when card scanning fails or is unavailable.

    Strictly requires authenticated teacher credentials.
    """
    student = StudentsRepository.get_by_id(conn, payload.student_id)
    if not student or student.get("is_active") != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "STUDENT_NOT_FOUND",
                "message": "Active student not found.",
            },
        )

    kiosk_session_manager.reset_failed_identification()
    full_name = student["display_name"]
    first_name = full_name.split()[0] if full_name else None

    logger.info(
        "Manual identification performed by teacher '%s' for student '%s'",
        current_teacher.get("username"),
        payload.student_id,
    )

    return ResponseEnvelope(
        data=KioskIdentifyResponseData(
            student_id=student["student_id"],
            display_handle=first_name or "Handwasher",
            first_name=first_name,
            retry_count=0,
            teacher_assistance_required=False,
        )
    )


@router.post("/sessions", response_model=ResponseEnvelope[KioskSessionResponse])
def create_kiosk_session(
    payload: KioskCreateSessionRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskSessionResponse]:
    """Create a new guidance session after credential resolution or as an unassigned session."""
    try:
        session_info = kiosk_session_manager.start_session(
            conn=conn,
            student_id=payload.student_id,
            is_unassigned=payload.is_unassigned,
            kiosk_id=payload.kiosk_id,
        )
    except SessionAlreadyActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "SESSION_ALREADY_ACTIVE", "message": str(exc)},
        ) from exc
    except UnassignedSessionsDisabledError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "UNASSIGNED_SESSIONS_DISABLED", "message": str(exc)},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CANNOT_START_SESSION", "message": str(exc)},
        ) from exc

    return ResponseEnvelope(
        data=KioskSessionResponse(
            session_id=session_info["session_id"],
            student_id=session_info["student_id"],
            is_unassigned=session_info["is_unassigned"],
            kiosk_id=session_info["kiosk_id"],
            started_at=session_info["started_at"],
            state=session_info["state"],
            protocol_version=session_info["protocol_version"],
            current_step_code=session_info["current_step_code"],
            current_step_index=session_info["current_step_index"],
            total_steps=session_info["total_steps"],
            qualifies_for_points=False,
        )
    )


@router.get(
    "/sessions/{session_id}", response_model=ResponseEnvelope[KioskSessionResponse]
)
def get_kiosk_session(
    session_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskSessionResponse]:
    """Fetch session details, current state, and progress."""
    sess_row = SessionsRepository.get_by_id(conn, session_id)
    if not sess_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": "Session not found."},
        )

    engine = kiosk_session_manager.active_engine
    is_active = engine is not None and engine.session_id == session_id

    current_code = (
        engine.current_step.step_code if is_active and engine.current_step else None
    )
    current_idx = engine.current_step_index if is_active else 0
    state_str = engine.state.value if is_active else sess_row["outcome"]

    return ResponseEnvelope(
        data=KioskSessionResponse(
            session_id=sess_row["session_id"],
            student_id=sess_row["student_id"],
            is_unassigned=sess_row["student_id"] is None,
            kiosk_id=sess_row["kiosk_id"],
            started_at=sess_row["started_at"],
            ended_at=sess_row["ended_at"],
            state=state_str,
            protocol_version=sess_row["protocol_version"],
            current_step_code=current_code,
            current_step_index=current_idx,
            total_steps=9,
            qualifies_for_points=bool(sess_row["qualifies_for_points"]),
            duration_seconds=sess_row["duration_seconds"],
        )
    )


@router.post(
    "/sessions/{session_id}/complete",
    response_model=ResponseEnvelope[KioskCompleteSessionResponse],
)
def complete_kiosk_session(
    session_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskCompleteSessionResponse]:
    """Finalize a session, calculate technique score, issue points, and return camera to IDENTIFY.

    Idempotent: Subsequent calls return previously recorded completion data.
    """
    try:
        result = kiosk_session_manager.complete_session(conn, session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "COMPLETION_FAILED", "message": str(exc)},
        ) from exc

    return ResponseEnvelope(
        data=KioskCompleteSessionResponse(
            session_id=result["session_id"],
            outcome=result["outcome"],
            technique_score=result["technique_score"],
            points_awarded=result["points_awarded"],
            qualifies_for_points=result["qualifies_for_points"],
            reason_code=result["reason_code"],
            duration_seconds=result["duration_seconds"],
            status=result["status"],
            breakdown=result["breakdown"],
        )
    )


@router.post("/sessions/{session_id}/cancel")
def cancel_kiosk_session(
    session_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[dict[str, Any]]:
    """Cancel or abandon an active kiosk session without awarding points."""
    try:
        kiosk_session_manager.cancel_session(conn, session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CANCEL_FAILED", "message": str(exc)},
        ) from exc

    return ResponseEnvelope(data={"cancelled": True, "session_id": session_id})


@router.get(
    "/students/{student_id}/progress",
    response_model=ResponseEnvelope[KioskStudentProgressResponse],
)
def get_kiosk_student_progress(
    student_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[KioskStudentProgressResponse]:
    """Retrieve personal monthly progress for the identified student on the kiosk.

    Privacy Invariant:
    - Never returns other students' records or school rosters.
    """
    student = StudentsRepository.get_by_id(conn, student_id)
    if not student or student.get("is_active") != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "STUDENT_NOT_FOUND",
                "message": "Active student not found.",
            },
        )

    now = datetime.now(UTC)
    first_of_month = datetime(now.year, now.month, 1, tzinfo=UTC).isoformat()

    monthly_points = RewardTransactionsRepository.get_student_points_summary(
        conn, student_id=student_id, start_date=first_of_month
    )

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT COUNT(*) FROM sessions
        WHERE student_id = ? AND outcome = 'completed' AND qualifies_for_points = 1;
        """,
        (student_id,),
    )
    row = cursor.fetchone()
    qualifying_count = row[0] if row else 0

    badges_rows = StudentAchievementsRepository.list_by_student(conn, student_id)
    badges = [
        KioskBadgeItem(
            achievement_id=b["achievement_id"],
            name=b["name"],
            description=b["description"] or "",
            awarded_at=b["awarded_at"],
        )
        for b in badges_rows
    ]

    full_name = student["display_name"]
    first_name = full_name.split()[0] if full_name else "Hero"

    target_points = max(50, ((monthly_points // 50) + 1) * 50)

    return ResponseEnvelope(
        data=KioskStudentProgressResponse(
            student_id=student_id,
            display_handle=first_name,
            monthly_points=monthly_points,
            qualifying_sessions=qualifying_count,
            badges=badges,
            next_achievement={
                "name": "Super Bubsy Star",
                "target_points": target_points,
                "points_remaining": max(0, target_points - monthly_points),
            },
        )
    )


@router.websocket("/sessions/{session_id}/events")
async def kiosk_events_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """Real-time child-safe event stream for active guidance sessions.

    Privacy invariants:
    - Zero image or video frames transmitted.
    - Zero raw confidence percentages transmitted.
    - Transmits only child-friendly status hints, instructions, and duration progress.
    """
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()

    try:
        loop = asyncio.get_running_loop()
        kiosk_session_manager.set_event_loop(loop)
    except RuntimeError:
        logger.debug("No active asyncio loop available when subscribing websocket.")

    kiosk_session_manager.subscribe(session_id, queue)
    logger.info("WebSocket client connected for session %s events", session_id)

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if event.get("is_completed"):
                break
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected for session %s", session_id)
    finally:
        kiosk_session_manager.unsubscribe(session_id, queue)
