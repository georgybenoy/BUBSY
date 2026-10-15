"""Class management API v1 routes."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.classes import (
    ClassCreateRequest,
    ClassPublic,
    ClassSummary,
    ClassUpdateRequest,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.class_service import ClassService

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("", response_model=ResponseEnvelope[list[ClassSummary]])
def list_classes(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    _: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    active_only: bool = Query(
        default=False, description="Filter for active classes only"
    ),
) -> ResponseEnvelope[list[ClassSummary]]:
    """List classes along with aggregated compliance metrics."""
    summaries = ClassService.list_classes_summary(conn, active_only=active_only)
    items = [ClassSummary.model_validate(s) for s in summaries]
    return ResponseEnvelope(data=items)


@router.post("", response_model=ResponseEnvelope[ClassPublic])
def create_class(
    payload: ClassCreateRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[ClassPublic]:
    """Create a new class."""
    created = ClassService.create_class(
        conn=conn,
        name=payload.name,
        academic_year=payload.academic_year,
        grade=payload.grade,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data=ClassPublic.model_validate(created))


@router.get("/{class_id}", response_model=ResponseEnvelope[ClassPublic])
def get_class(
    class_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    _: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[ClassPublic]:
    """Fetch class details by ID."""
    record = ClassService.get_class_by_id(conn, class_id)
    return ResponseEnvelope(data=ClassPublic.model_validate(record))


@router.patch("/{class_id}", response_model=ResponseEnvelope[ClassPublic])
def update_class(
    class_id: str,
    payload: ClassUpdateRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[ClassPublic]:
    """Update class attributes."""
    updated = ClassService.update_class(
        conn=conn,
        class_id=class_id,
        name=payload.name,
        grade=payload.grade,
        academic_year=payload.academic_year,
        is_active=payload.is_active,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data=ClassPublic.model_validate(updated))
