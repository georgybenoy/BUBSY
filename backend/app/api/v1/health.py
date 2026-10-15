"""Health check endpoint for Bubsy API."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.envelope import HealthData, ResponseEnvelope

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=ResponseEnvelope[HealthData])
async def get_health() -> ResponseEnvelope[HealthData]:
    """Return system operational status wrapped in standard envelope."""
    payload = HealthData(
        status="healthy",
        app_name=settings.APP_NAME,
        version="0.1.0",
        timestamp=datetime.now(UTC).isoformat(),
        environment=settings.APP_ENV,
    )
    return ResponseEnvelope[HealthData](
        data=payload,
        error=None,
        request_id=f"req_{uuid.uuid4().hex[:12]}",
    )
