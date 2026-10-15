"""Schemas for student operations."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StudentCreateRequest(BaseModel):
    """Payload to create a new student record."""

    display_name: str = Field(
        ..., min_length=1, max_length=100, description="Approved student name"
    )
    class_id: str = Field(..., description="UUID of the assigned class")
    school_student_code: str | None = Field(
        default=None, max_length=64, description="Optional school-assigned ID"
    )
    auto_issue_qr: bool = Field(
        default=True, description="Whether to immediately issue a QR credential"
    )


class StudentUpdateRequest(BaseModel):
    """Payload to update an existing student record."""

    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    class_id: str | None = Field(default=None)
    school_student_code: str | None = Field(default=None, max_length=64)
    is_active: int | None = Field(default=None, ge=0, le=1)


class StudentPublic(BaseModel):
    """Public representation of a student (strictly adheres to privacy rules)."""

    model_config = ConfigDict(from_attributes=True)

    student_id: str
    school_student_code: str | None = None
    display_name: str
    class_id: str
    class_name: str | None = None
    is_active: int
    created_at: str
    updated_at: str


class StudentRowItem(BaseModel):
    """Table item representation for students page."""

    model_config = ConfigDict(from_attributes=True)

    student_id: str
    school_student_code: str | None = None
    display_name: str
    class_id: str
    class_name: str | None = None
    is_active: int
    monthly_points: int = 0
    qualifying_washes: int = 0


class StudentCreateResponseData(BaseModel):
    """Response payload when creating a student."""

    student: StudentPublic
    raw_qr_token: str | None = None


class StudentListResponseData(BaseModel):
    """Paginated list of students."""

    items: list[StudentRowItem]
    total_count: int
    page: int
    page_size: int


class StudentDetailResponseData(BaseModel):
    """Detailed profile shell view with credentials."""

    student: StudentPublic
    credentials: list[dict[str, Any]] = Field(default_factory=list)
    active_qr_credential_id: str | None = None
    active_nfc_credential_id: str | None = None


class CSVImportResponseData(BaseModel):
    """Outcome report for batch student onboarding."""

    imported_count: int
    skipped_count: int
    errors: list[dict[str, Any]] = Field(default_factory=list)
