"""Schemas for school class operations."""

from pydantic import BaseModel, ConfigDict, Field


class ClassCreateRequest(BaseModel):
    """Payload to create a new class."""

    name: str = Field(
        ..., min_length=1, max_length=64, description="Class name, e.g. 'Grade 5A'"
    )
    academic_year: str = Field(
        default="2026-2027", min_length=4, max_length=16, description="Academic year"
    )
    grade: str | None = Field(
        default=None, max_length=16, description="Optional grade/year level"
    )


class ClassUpdateRequest(BaseModel):
    """Payload to update an existing class."""

    name: str | None = Field(default=None, min_length=1, max_length=64)
    grade: str | None = Field(default=None, max_length=16)
    academic_year: str | None = Field(default=None, min_length=4, max_length=16)
    is_active: int | None = Field(default=None, ge=0, le=1)


class ClassPublic(BaseModel):
    """Public representation of a class."""

    model_config = ConfigDict(from_attributes=True)

    class_id: str
    name: str
    grade: str | None = None
    academic_year: str
    is_active: int
    created_at: str
    updated_at: str


class ClassSummary(BaseModel):
    """Aggregated summary representation for class cards."""

    model_config = ConfigDict(from_attributes=True)

    class_id: str
    name: str
    grade: str | None = None
    academic_year: str
    is_active: int
    student_count: int = 0
    qualifying_wash_count: int = 0
    protocol_completion_rate: int = 0
    total_points: int = 0
