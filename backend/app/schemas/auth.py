"""Authentication and teacher schemas."""

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Staff login payload."""

    username: str = Field(
        ..., min_length=1, max_length=100, description="Login username"
    )
    password: str = Field(
        ..., min_length=1, max_length=128, description="Account password"
    )


class TeacherPublic(BaseModel):
    """Sanitized public teacher representation (no password hash)."""

    model_config = ConfigDict(from_attributes=True)

    teacher_id: str
    username: str
    role: str
    is_active: int
    created_at: str
    last_login_at: str | None = None


class LoginResponseData(BaseModel):
    """Data payload for successful login response."""

    token: str = Field(..., description="Server-side session bearer token")
    csrf_token: str = Field(..., description="CSRF token for cookie-based interactions")
    teacher: TeacherPublic = Field(..., description="Authenticated teacher profile")


class LogoutResponseData(BaseModel):
    """Data payload for logout response."""

    logged_out: bool = True


class UpdateTeacherStatusRequest(BaseModel):
    """Request payload to change teacher active status."""

    is_active: int = Field(
        ...,
        ge=0,
        le=1,
        description="1 to activate account, 0 to disable account immediately",
    )
