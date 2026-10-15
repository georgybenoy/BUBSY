"""Pydantic schemas for /api/v1/leaderboard, transactions, and point corrections."""

from pydantic import BaseModel, ConfigDict, Field


class LeaderboardItem(BaseModel):
    """Ranked student leaderboard entry."""

    model_config = ConfigDict(extra="ignore")

    rank: int
    student_id: str
    display_name: str
    student_code: str | None = None
    class_id: str
    class_name: str
    total_points: int
    qualifying_washes: int
    avg_technique_score: float


class LeaderboardResponse(BaseModel):
    """Paginated monthly leaderboard standings."""

    model_config = ConfigDict(extra="ignore")

    items: list[LeaderboardItem]
    month: str
    timezone: str
    total: int
    page: int
    limit: int
    total_pages: int


class PointTransactionItem(BaseModel):
    """Historical point transaction record."""

    model_config = ConfigDict(extra="ignore")

    transaction_id: str
    student_id: str
    student_name: str | None = None
    session_id: str | None = None
    points_delta: int
    reason_code: str
    created_at: str
    notes: str | None = None
    created_by_teacher_id: str | None = None


class PointTransactionListResponse(BaseModel):
    """Paginated point transaction audit history."""

    model_config = ConfigDict(extra="ignore")

    items: list[PointTransactionItem]
    total: int
    page: int
    limit: int
    total_pages: int


class PointCorrectionRequest(BaseModel):
    """Audited compensating transaction request to correct student points."""

    model_config = ConfigDict(extra="ignore")

    student_id: str
    points_delta: int = Field(..., description="Points to adjust (+ or -), cannot be 0")
    reason: str = Field(
        ..., min_length=3, description="Auditable explanation for point adjustment"
    )
    notes: str | None = Field(None, description="Optional extra notes")
    session_id: str | None = Field(None, description="Optional associated session ID")
