"""Pydantic schemas for school application settings."""

from pydantic import BaseModel, ConfigDict, Field


class SettingsResponse(BaseModel):
    """Complete application settings configuration."""

    model_config = ConfigDict(extra="ignore")

    school_timezone: str = "UTC"
    protocol_version: str = "1.0.0"
    min_step_duration_seconds: int = 3
    min_qualifying_score: float = 70.0
    daily_reward_cap: int = 3
    leaderboard_visibility: str = "public"
    kiosk_language: str = "en"
    kiosk_audio_enabled: bool = True
    first_name_display_allowed: bool = True
    allow_unassigned_sessions: bool = True
    data_retention_days: int = 365


class SettingsUpdateRequest(BaseModel):
    """Update payload for school settings (admin only)."""

    model_config = ConfigDict(extra="ignore")

    school_timezone: str | None = Field(None, description="Valid IANA timezone name")
    protocol_version: str | None = None
    min_step_duration_seconds: int | None = Field(None, ge=1, le=30)
    min_qualifying_score: float | None = Field(None, ge=0.0, le=100.0)
    daily_reward_cap: int | None = Field(None, ge=1, le=20)
    leaderboard_visibility: str | None = Field(
        None, pattern="^(public|school_only|hidden)$"
    )
    kiosk_language: str | None = Field(None, pattern="^(en|es)$")
    kiosk_audio_enabled: bool | None = None
    first_name_display_allowed: bool | None = None
    allow_unassigned_sessions: bool | None = None
    data_retention_days: int | None = Field(None, ge=30, le=3650)
