"""Pydantic schemas for /api/v1/analytics trends, distributions, and exports."""

from pydantic import BaseModel, ConfigDict, Field


class DailyTrendItem(BaseModel):
    """Daily session and qualification numbers."""

    model_config = ConfigDict(extra="ignore")

    date: str = Field(..., description="ISO Date YYYY-MM-DD")
    total_sessions: int = 0
    qualifying_sessions: int = 0
    completion_rate: float = 0.0


class MonthlyTrendItem(BaseModel):
    """Monthly summary numbers."""

    model_config = ConfigDict(extra="ignore")

    month: str = Field(..., description="YYYY-MM")
    total_sessions: int = 0
    qualifying_sessions: int = 0


class ClassCompletionItem(BaseModel):
    """Protocol completion metrics normalized by class size."""

    model_config = ConfigDict(extra="ignore")

    class_id: str
    class_name: str
    registered_students: int
    qualifying_washes: int
    completion_rate: float
    washes_per_student: float = Field(
        ..., description="Average qualifying washes per student (normalized for size)"
    )


class ParticipationBucket(BaseModel):
    """Student frequency distribution bucket."""

    model_config = ConfigDict(extra="ignore")

    bucket_label: str = Field(
        ..., description="E.g. '0 washes', '1-5 washes', '6-15 washes', '16+ washes'"
    )
    student_count: int
    percentage: float


class CommonlyMissedStepItem(BaseModel):
    """Step difficulty analysis based on uncertain or retry outcomes."""

    model_config = ConfigDict(extra="ignore")

    step_code: str
    step_name: str
    total_attempts: int
    recognized_count: int
    uncertain_count: int
    retry_count: int
    skipped_count: int
    uncertainty_rate: float = Field(
        ..., description="Percentage of attempts encountering uncertainty or retry"
    )


class AnalyticsResponse(BaseModel):
    """Comprehensive school analytics payload."""

    model_config = ConfigDict(extra="ignore")

    period: str
    disclaimer: str = Field(
        "Note: AI technique recognition reflects protocol adherence and does not prove microbiological cleanliness or germ elimination.",
        description="Mandatory hygiene disclaimer",
    )
    daily_trends: list[DailyTrendItem]
    monthly_trends: list[MonthlyTrendItem]
    completion_by_class: list[ClassCompletionItem]
    participation_distribution: list[ParticipationBucket]
    commonly_missed_steps: list[CommonlyMissedStepItem]
