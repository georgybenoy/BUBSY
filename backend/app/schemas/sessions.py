"""Pydantic schemas for teacher session review and detail inspection."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SessionListItem(BaseModel):
    """Summarized session row for list table."""

    model_config = ConfigDict(extra="ignore")

    session_id: str
    student_id: str | None = None
    student_name: str | None = None
    student_code: str | None = None
    class_id: str | None = None
    class_name: str | None = None
    kiosk_id: str
    started_at: str
    ended_at: str | None = None
    duration_seconds: int | None = None
    outcome: str
    qualifies_for_points: bool
    points_awarded: int = 0
    failure_reason: str | None = None
    recognized_steps_count: int = 0
    total_steps_count: int = 0
    outcome_category: str = Field(
        ...,
        description="Categorized outcome: completed-qualifying, incomplete, recognition_uncertain, cancelled, device_failure",
    )


class SessionListResponse(BaseModel):
    """Paginated response for session listing."""

    model_config = ConfigDict(extra="ignore")

    items: list[SessionListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class SessionStepDetail(BaseModel):
    """Step execution detail from session_steps table."""

    model_config = ConfigDict(extra="ignore")

    session_step_id: str
    step_code: str
    step_name: str
    sequence_index: int
    result: str
    duration_ms: int | None = None
    confidence_summary: float | None = None
    created_at: str


class SessionDetailResponse(BaseModel):
    """Full forensic audit detail of a single handwashing session."""

    model_config = ConfigDict(extra="ignore")

    session_id: str
    student_id: str | None = None
    student_name: str | None = None
    student_code: str | None = None
    class_id: str | None = None
    class_name: str | None = None
    kiosk_id: str
    started_at: str
    ended_at: str | None = None
    duration_seconds: int | None = None
    outcome: str
    qualifies_for_points: bool
    points_awarded: int = 0
    failure_reason: str | None = None
    protocol_version: str
    model_version: str | None = None
    scoring_version: str
    outcome_category: str
    uncertainty_reasons: list[str] = Field(default_factory=list)
    expected_sequence: list[dict[str, Any]] = Field(default_factory=list)
    recognized_sequence: list[SessionStepDetail] = Field(default_factory=list)
    score_breakdown: dict[str, Any] = Field(default_factory=dict)
