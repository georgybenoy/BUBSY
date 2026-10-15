"""Schemas for kiosk interaction endpoints and child-safe events."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class KioskIdentifyRequest(BaseModel):
    """Minimal kiosk scanning/tapping payload."""

    credential_type: Literal["QR", "NFC"] = Field(
        ..., description="Type of presentation"
    )
    raw_value: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Scanned or tapped credential payload",
    )


class KioskIdentifyResponseData(BaseModel):
    """Session-safe minimal identity payload. Never exposes class rosters or other students."""

    student_id: str = Field(
        ..., description="Internal student identifier for starting guidance session"
    )
    display_handle: str = Field(
        ..., description="Encouraging student handle for display, e.g. first name"
    )
    first_name: str | None = Field(
        default=None, description="First name if school display policy permits"
    )
    retry_count: int = Field(
        default=0, description="Current failed scan count in active window"
    )
    teacher_assistance_required: bool = Field(
        default=False,
        description="Whether failed scans exceeded limit requiring teacher help",
    )


class KioskManualIdentifyRequest(BaseModel):
    """Teacher-assisted student identification payload."""

    student_id: str = Field(
        ..., description="Internal student ID selected by authorized teacher"
    )
    notes: str | None = Field(
        default=None, description="Optional teacher observation notes"
    )


class KioskCreateSessionRequest(BaseModel):
    """Payload to start a handwashing guidance session."""

    student_id: str | None = Field(
        default=None,
        description="Internal student ID from resolved credential",
    )
    is_unassigned: bool = Field(
        default=False,
        description="Whether to run an anonymous/unassigned session",
    )
    kiosk_id: str = Field(default="kiosk-1", description="Device identifier")


class KioskSessionResponse(BaseModel):
    """Structured response for an active or completed session."""

    session_id: str
    student_id: str | None
    is_unassigned: bool
    kiosk_id: str
    started_at: str
    ended_at: str | None = None
    state: str
    protocol_version: str
    current_step_code: str | None = None
    current_step_index: int = 0
    total_steps: int = 9
    qualifies_for_points: bool = False
    duration_seconds: int | None = None


class KioskCompleteSessionResponse(BaseModel):
    """Result of finalized session scoring and rewards."""

    session_id: str
    outcome: str
    technique_score: float
    points_awarded: int
    qualifies_for_points: bool
    reason_code: str
    duration_seconds: int
    status: str
    breakdown: dict[str, Any]


class KioskChildSafeEvent(BaseModel):
    """Privacy-safe real-time event pushed over WebSocket to the kiosk UI.

    Privacy Invariants:
    - Never contains camera frames or images.
    - Never exposes raw confidence percentages to the student.
    - Uses encouraging, child-friendly feedback terminology.
    """

    session_id: str
    step_code: str
    sequence_index: int
    step_number: int
    total_steps: int
    step_name: str
    prompt_text: str
    status_hint: str = Field(
        ...,
        description="Encouraging hint: GREAT_START, KEEP_RUBBING, TRY_SLOWER, RETRY, STEP_COMPLETED",
    )
    progress_ratio: float = Field(
        ..., ge=0.0, le=1.0, description="Step duration progress from 0.0 to 1.0"
    )
    is_verified_step: bool
    is_completed: bool = False


class SystemStatusResponse(BaseModel):
    """System health and hardware diagnostics for teacher/operator review."""

    camera: dict[str, Any]
    recognition_service: dict[str, Any]
    qr_scanner: dict[str, Any]
    nfc_reader: dict[str, Any]
    database: dict[str, Any]
    recent_errors: list[dict[str, Any]] = Field(default_factory=list)


class KioskConfigResponse(BaseModel):
    """Kiosk feature and device configuration settings."""

    kiosk_id: str = "kiosk-1"
    allow_unassigned_sessions: bool = True
    nfc_available: bool = False
    max_id_retries: int = 3
    first_name_display_allowed: bool = True


class KioskBadgeItem(BaseModel):
    """Achievement badge item earned by student."""

    achievement_id: str
    name: str
    description: str
    awarded_at: str


class KioskStudentProgressResponse(BaseModel):
    """Personal monthly progress summary for the identified student only."""

    student_id: str
    display_handle: str
    monthly_points: int
    qualifying_sessions: int
    badges: list[KioskBadgeItem] = Field(default_factory=list)
    next_achievement: dict[str, Any] | None = None
