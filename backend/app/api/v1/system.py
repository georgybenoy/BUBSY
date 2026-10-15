"""System health, hardware diagnostics, and telemetry endpoints.

Per PRD section 9.7, 7.3, and Phase 7 specifications:
- Reports camera status, recognition service, model version, QR scanner, NFC reader, and DB.
- Restricted strictly to authorized teachers and operators via RBAC.
"""

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_db, require_role
from app.core.logging import logger
from app.schemas.envelope import ResponseEnvelope
from app.schemas.kiosk import SystemStatusResponse
from app.services.kiosk_session_manager import kiosk_session_manager

router = APIRouter(prefix="/system", tags=["System Diagnostics"])


@router.get(
    "/status",
    response_model=ResponseEnvelope[SystemStatusResponse],
    dependencies=[Depends(require_role("admin", "teacher", "operator"))],
)
def get_system_status(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[SystemStatusResponse]:
    """Retrieve comprehensive hardware, camera, recognition model, and reader diagnostics.

    Requires teacher or operator role.
    """
    # 1. Vision diagnostics
    vision_diag = kiosk_session_manager.vision_runner.get_diagnostics()

    # 2. NFC reader status
    nfc_status = kiosk_session_manager.credential_reader.get_status()

    # 3. Database check
    db_healthy = True
    try:
        conn.cursor().execute("SELECT 1;").fetchone()
    except sqlite3.Error as exc:
        logger.warning("Database probe failed during system status check: %s", exc)
        db_healthy = False

    data = SystemStatusResponse(
        camera=vision_diag["camera"],
        recognition_service=vision_diag["recognition_service"],
        qr_scanner=vision_diag["qr_scanner"],
        nfc_reader=nfc_status,
        database={"status": "healthy" if db_healthy else "unhealthy"},
        recent_errors=vision_diag.get("recent_errors", []),
    )

    return ResponseEnvelope(data=data)
