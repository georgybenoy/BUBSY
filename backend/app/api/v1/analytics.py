"""API endpoints for /api/v1/analytics trends, distributions, and CSV export."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.analytics import AnalyticsResponse
from app.schemas.envelope import ResponseEnvelope
from app.services.analytics_service import (
    generate_analytics_csv,
    get_analytics_data,
)

router = APIRouter(prefix="/analytics", tags=["Teacher Analytics"])


@router.get("", response_model=ResponseEnvelope[AnalyticsResponse])
def get_analytics(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    period: str | None = Query(
        None, description="Month in YYYY-MM format or 'current_month'"
    ),
    class_id: str | None = Query(None, description="Filter by class ID"),
) -> ResponseEnvelope[AnalyticsResponse]:
    """Retrieve trends, normalized class completion, participation buckets, and step analysis."""
    data = get_analytics_data(conn=conn, period=period, class_id=class_id)
    return ResponseEnvelope[AnalyticsResponse](data=AnalyticsResponse(**data))


@router.get("/export")
def export_analytics_csv(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    period: str | None = Query(
        None, description="Month in YYYY-MM format or 'current_month'"
    ),
    class_id: str | None = Query(None, description="Filter by class ID"),
) -> Response:
    """Download sanitized CSV report of session activity.

    Invariants:
    1. Authenticated staff only.
    2. Includes mandatory hygiene disclaimer header.
    3. Formula injection sanitized.
    4. Row limit bounded.
    """
    csv_content = generate_analytics_csv(conn=conn, period=period, class_id=class_id)
    safe_period = period if period and period != "current_month" else "current_period"
    filename = f"bubsy_analytics_export_{safe_period}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
