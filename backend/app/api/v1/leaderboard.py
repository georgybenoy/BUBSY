"""API endpoints for /api/v1/leaderboard, point transactions, and compensating corrections."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_teacher, get_db, require_role
from app.schemas.envelope import ResponseEnvelope
from app.schemas.leaderboard import (
    LeaderboardResponse,
    PointCorrectionRequest,
    PointTransactionItem,
    PointTransactionListResponse,
)
from app.services.leaderboard_query_service import (
    create_point_correction,
    list_point_transactions,
    query_leaderboard,
)

router = APIRouter(prefix="/leaderboard", tags=["Teacher Leaderboard"])

require_teacher_or_admin = require_role("admin", "teacher")


@router.get("", response_model=ResponseEnvelope[LeaderboardResponse])
def get_leaderboard(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    month: str | None = Query(None, description="Month in YYYY-MM format"),
    class_id: str | None = Query(None, description="Filter by class ID"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
) -> ResponseEnvelope[LeaderboardResponse]:
    """Retrieve monthly leaderboard rankings with tie-break rules and timezone boundaries."""
    data = query_leaderboard(
        conn=conn,
        month=month,
        class_id=class_id,
        page=page,
        limit=limit,
    )
    return ResponseEnvelope[LeaderboardResponse](data=LeaderboardResponse(**data))


@router.get(
    "/transactions", response_model=ResponseEnvelope[PointTransactionListResponse]
)
def get_point_transactions(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    student_id: str | None = Query(None, description="Filter by student ID"),
    month: str | None = Query(None, description="Month in YYYY-MM format"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
) -> ResponseEnvelope[PointTransactionListResponse]:
    """Review historical point transactions for students."""
    data = list_point_transactions(
        conn=conn,
        student_id=student_id,
        month=month,
        page=page,
        limit=limit,
    )
    return ResponseEnvelope[PointTransactionListResponse](
        data=PointTransactionListResponse(**data)
    )


@router.post("/corrections", response_model=ResponseEnvelope[PointTransactionItem])
def submit_point_correction(
    payload: PointCorrectionRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(require_teacher_or_admin)],
) -> ResponseEnvelope[PointTransactionItem]:
    """Create an audited compensating transaction to adjust student points.

    Invariants:
    1. Historical transactions are never mutated or deleted.
    2. RBAC: restricted to teacher and admin roles.
    3. Action logged to audit_events.
    """
    try:
        record = create_point_correction(
            conn=conn,
            student_id=payload.student_id,
            points_delta=payload.points_delta,
            reason=payload.reason,
            teacher_id=current_teacher["teacher_id"],
            notes=payload.notes,
            session_id=payload.session_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CORRECTION", "message": str(exc)},
        ) from exc

    return ResponseEnvelope[PointTransactionItem](
        data=PointTransactionItem(
            transaction_id=record["transaction_id"],
            student_id=record["student_id"],
            student_name=None,
            session_id=record["session_id"],
            points_delta=record["points_delta"],
            reason_code=record["reason_code"],
            created_at=record["created_at"],
            notes=record["notes"],
            created_by_teacher_id=record["created_by_teacher_id"],
        )
    )
