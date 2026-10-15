"""Student management API v1 routes."""

import sqlite3
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)
from pydantic import BaseModel

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.envelope import ResponseEnvelope
from app.schemas.students import (
    CSVImportResponseData,
    StudentCreateRequest,
    StudentCreateResponseData,
    StudentDetailResponseData,
    StudentListResponseData,
    StudentPublic,
    StudentRowItem,
    StudentUpdateRequest,
)
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["Students"])


class CSVTextImportRequest(BaseModel):
    """Optional JSON payload containing raw CSV text."""

    csv_text: str


@router.get("", response_model=ResponseEnvelope[StudentListResponseData])
def list_students(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    _: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    page: int = Query(default=1, ge=1, description="Page index"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    class_id: str | None = Query(default=None, description="Optional class ID filter"),
    is_active: int | None = Query(
        default=None, ge=0, le=1, description="Active status filter"
    ),
    search: str | None = Query(
        default=None, description="Search term for display name or school code"
    ),
) -> ResponseEnvelope[StudentListResponseData]:
    """Fetch paginated students list with wash metrics."""
    items, total_count = StudentService.list_students_paginated(
        conn=conn,
        page=page,
        page_size=page_size,
        class_id=class_id,
        is_active=is_active,
        search=search,
    )
    row_items = [StudentRowItem.model_validate(item) for item in items]
    return ResponseEnvelope(
        data=StudentListResponseData(
            items=row_items,
            total_count=total_count,
            page=page,
            page_size=page_size,
        )
    )


@router.post("", response_model=ResponseEnvelope[StudentCreateResponseData])
def create_student(
    payload: StudentCreateRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[StudentCreateResponseData]:
    """Create a new student and optionally issue an initial QR credential."""
    student, raw_qr_token = StudentService.create_student(
        conn=conn,
        display_name=payload.display_name,
        class_id=payload.class_id,
        school_student_code=payload.school_student_code,
        auto_issue_qr=payload.auto_issue_qr,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(
        data=StudentCreateResponseData(
            student=StudentPublic.model_validate(student),
            raw_qr_token=raw_qr_token,
        )
    )


@router.get("/{student_id}", response_model=ResponseEnvelope[StudentDetailResponseData])
def get_student_detail(
    student_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    _: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[StudentDetailResponseData]:
    """Fetch student profile shell and credential status."""
    detail = StudentService.get_student_detail(conn, student_id)
    student_pub = StudentPublic.model_validate(detail)
    return ResponseEnvelope(
        data=StudentDetailResponseData(
            student=student_pub,
            credentials=detail.get("credentials", []),
            active_qr_credential_id=detail.get("active_qr_credential_id"),
            active_nfc_credential_id=detail.get("active_nfc_credential_id"),
        )
    )


@router.patch("/{student_id}", response_model=ResponseEnvelope[StudentPublic])
def update_student(
    student_id: str,
    payload: StudentUpdateRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[StudentPublic]:
    """Update student attributes."""
    updated = StudentService.update_student(
        conn=conn,
        student_id=student_id,
        display_name=payload.display_name,
        class_id=payload.class_id,
        school_student_code=payload.school_student_code,
        is_active=payload.is_active,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data=StudentPublic.model_validate(updated))


@router.patch("/{student_id}/status", response_model=ResponseEnvelope[StudentPublic])
def set_student_status(
    student_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    is_active: Annotated[
        int, Query(ge=0, le=1, description="1 for active, 0 for inactive")
    ] = 1,
) -> ResponseEnvelope[StudentPublic]:
    """Soft-deactivate or reactivate a student."""
    updated = StudentService.set_student_active_status(
        conn=conn,
        student_id=student_id,
        is_active=is_active,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data=StudentPublic.model_validate(updated))


@router.post("/import", response_model=ResponseEnvelope[CSVImportResponseData])
async def import_students_from_csv(
    request: Request,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[CSVImportResponseData]:
    """Import students from a CSV file or text payload with sanitization."""
    content_type = request.headers.get("content-type", "")
    csv_text: str = ""

    if "application/json" in content_type:
        body = await request.json()
        csv_text = body.get("csv_text", "")
    elif "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if uploaded_file and hasattr(uploaded_file, "read"):
            raw_bytes = await uploaded_file.read()
            try:
                csv_text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                csv_text = raw_bytes.decode("latin-1")
    else:
        # Raw text body
        raw_bytes = await request.body()
        csv_text = raw_bytes.decode("utf-8", errors="replace")

    if not csv_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_CSV", "message": "No CSV content provided."},
        )

    result = StudentService.import_students_csv(
        conn=conn,
        csv_text=csv_text,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data=CSVImportResponseData.model_validate(result))
