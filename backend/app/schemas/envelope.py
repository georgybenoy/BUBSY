"""Standard Response Envelope schema according to CODE_STYLE.md Section 5.

All REST endpoints wrap outputs in this consistent envelope structure.
"""

import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class ErrorDetail(BaseModel):
    """Structured error payload without exposing internal stack traces."""

    code: str = Field(
        ..., description="Stable error code, e.g. NOT_FOUND, VALIDATION_ERROR"
    )
    message: str = Field(..., description="Human-readable, sanitized error description")


class ResponseEnvelope(BaseModel, Generic[DataT]):
    """Unified API response envelope matching CODE_STYLE.md Section 5."""

    data: DataT | None = Field(
        default=None, description="Primary payload or null on error"
    )
    error: ErrorDetail | None = Field(
        default=None, description="Error detail or null on success"
    )
    request_id: str = Field(
        default_factory=lambda: f"req_{uuid.uuid4().hex[:12]}",
        description="Opaque request tracing identifier",
    )


class HealthData(BaseModel):
    """Payload for the /health endpoint."""

    status: str = Field(default="ok", description="Service health state")
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Software version")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    environment: str = Field(..., description="Runtime environment")
