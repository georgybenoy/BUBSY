"""API endpoints for /api/v1/sessions teacher inspection."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.envelope import ResponseEnvelope
from app.schemas.sessions import SessionDetailResponse, SessionListResponse
from app.services.wash_session_service import (
    get_session_detail_service,
    list_sessions_service,
)

router = APIRouter(prefix="/sessions", tags=["Teacher Wash Sessions"])


@router.get("", response_model=ResponseEnvelope[SessionListResponse])
def list_sessions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    start_date: str | None = Query(None, description="Start timestamp or date filter"),
    end_date: str | None = Query(None, description="End timestamp or date filter"),
    class_id: str | None = Query(None, description="Filter by class ID"),
    student_id: str | None = Query(None, description="Filter by student ID"),
    outcome: str | None = Query(None, description="Filter by outcome"),
    kiosk_id: str | None = Query(None, description="Filter by kiosk ID"),
) -> ResponseEnvelope[SessionListResponse]:
    """List sessions with rich filtering and pagination for teacher inspection."""
    data = list_sessions_service(
        conn=conn,
        page=page,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        class_id=class_id,
        student_id=student_id,
        outcome=outcome,
        kiosk_id=kiosk_id,
    )
    return ResponseEnvelope[SessionListResponse](data=SessionListResponse(**data))


@router.get("/{session_id}", response_model=ResponseEnvelope[SessionDetailResponse])
def get_session_detail(
    session_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[SessionDetailResponse]:
    """Fetch complete forensic audit for a single handwashing session."""
    data = get_session_detail_service(conn=conn, session_id=session_id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SESSION_NOT_FOUND", "message": "Session not found."},
        )
    return ResponseEnvelope[SessionDetailResponse](data=SessionDetailResponse(**data))
