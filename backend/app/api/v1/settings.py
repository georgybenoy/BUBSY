"""API endpoints for school settings management and auditable updates."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_active_teacher, get_db, require_role
from app.schemas.envelope import ResponseEnvelope
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest
from app.services.settings_service import (
    get_all_settings,
    update_settings_service,
)

router = APIRouter(prefix="/settings", tags=["School Settings"])

require_admin = require_role("admin")


@router.get("", response_model=ResponseEnvelope[SettingsResponse])
def get_settings(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[SettingsResponse]:
    """Retrieve all current school configuration settings."""
    data = get_all_settings(conn=conn)
    return ResponseEnvelope[SettingsResponse](data=SettingsResponse(**data))


@router.patch("", response_model=ResponseEnvelope[SettingsResponse])
def update_settings(
    payload: SettingsUpdateRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_admin: Annotated[dict[str, Any], Depends(require_admin)],
) -> ResponseEnvelope[SettingsResponse]:
    """Apply validated configuration updates and record audit event.

    RBAC: Restricted strictly to admin role.
    """
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        current = get_all_settings(conn=conn)
        return ResponseEnvelope[SettingsResponse](data=SettingsResponse(**current))

    try:
        updated = update_settings_service(
            conn=conn,
            updates=updates,
            teacher_id=current_admin["teacher_id"],
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SETTINGS", "message": str(exc)},
        ) from exc

    return ResponseEnvelope[SettingsResponse](data=SettingsResponse(**updated))
