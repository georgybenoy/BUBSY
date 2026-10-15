"""API endpoints for /api/v1/overview teacher dashboard."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.envelope import ResponseEnvelope
from app.schemas.overview import OverviewResponse
from app.services.overview_service import get_overview_data

router = APIRouter(prefix="/overview", tags=["Teacher Overview"])


@router.get("", response_model=ResponseEnvelope[OverviewResponse])
def get_overview(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    period: str | None = Query(
        None,
        description="Reporting period in YYYY-MM format or 'current_month' (default: current local month)",
    ),
) -> ResponseEnvelope[OverviewResponse]:
    """Retrieve top-level KPI metrics, trends, class comparisons, and status for Overview.

    Invariants:
    1. Auth enforced server-side.
    2. Data computed from real database queries.
    """
    data = get_overview_data(conn=conn, period=period)
    return ResponseEnvelope[OverviewResponse](data=OverviewResponse(**data))
