"""Pydantic schemas for /api/v1/overview teacher dashboard."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProtocolCompletionMetric(BaseModel):
    """Protocol completion rate breakdown."""

    model_config = ConfigDict(extra="ignore")

    numerator: int = Field(..., description="Number of fully completed sessions")
    denominator: int = Field(
        ..., description="Total recorded sessions in reporting period"
    )
    percentage: float = Field(..., description="Calculated percentage (0.0 to 100.0)")
    period: str = Field(
        ..., description="Formatted description of period, e.g. October 2026"
    )


class OverviewMetrics(BaseModel):
    """Top-level 4 high-value KPI metrics with documented definitions."""

    model_config = ConfigDict(extra="ignore")

    registered_students: int = Field(
        ..., description="Total count of active students across all classes"
    )
    qualifying_washes: int = Field(
        ..., description="Count of validated qualifying handwashing sessions in period"
    )
    protocol_completion: ProtocolCompletionMetric = Field(
        ..., description="Completion rate with explicit numerator and denominator"
    )
    active_participants: int = Field(
        ...,
        description="Distinct active students with at least 1 qualifying wash in period",
    )
    period: str = Field(..., description="Reporting period identifier (e.g. 2026-10)")


class ActivityTrendPoint(BaseModel):
    """Single date activity data point for trend charting."""

    model_config = ConfigDict(extra="ignore")

    date: str = Field(..., description="ISO date YYYY-MM-DD")
    total_sessions: int = Field(0, description="Total wash sessions initiated")
    qualifying_washes: int = Field(0, description="Qualifying completed sessions")


class ClassComparisonItem(BaseModel):
    """Class comparison metric normalized for size."""

    model_config = ConfigDict(extra="ignore")

    class_id: str
    class_name: str
    student_count: int
    qualifying_washes: int
    completion_rate: float
    washes_per_student: float


class RecentActivityItem(BaseModel):
    """Recent session item for dashboard activity feed."""

    model_config = ConfigDict(extra="ignore")

    session_id: str
    student_id: str | None = None
    student_name: str | None = None
    class_name: str | None = None
    started_at: str
    outcome: str
    qualifies_for_points: bool
    points_awarded: int


class LeaderboardSummaryItem(BaseModel):
    """Monthly Bubsy Champion top student summary."""

    model_config = ConfigDict(extra="ignore")

    rank: int
    student_id: str
    display_name: str
    total_points: int
    qualifying_washes: int


class OverviewResponse(BaseModel):
    """Comprehensive teacher overview dashboard payload."""

    model_config = ConfigDict(extra="ignore")

    metrics: OverviewMetrics
    activity_trend: list[ActivityTrendPoint]
    class_comparison: list[ClassComparisonItem]
    recent_activity: list[RecentActivityItem]
    leaderboard_summary: list[LeaderboardSummaryItem]
    device_status: dict[str, Any]
