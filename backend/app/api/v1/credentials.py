"""Credential management API v1 routes."""

import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from fastapi.responses import Response as RawResponse

from app.api.deps import get_current_active_teacher, get_db
from app.schemas.credentials import (
    CredentialIssueRequest,
    CredentialIssueResponseData,
    CredentialPrintQRRequest,
    CredentialPublic,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.credential_service import CredentialService

router = APIRouter(tags=["Credentials"])


@router.post(
    "/students/{student_id}/credentials",
    response_model=ResponseEnvelope[CredentialIssueResponseData],
)
def issue_credential(
    student_id: str,
    payload: CredentialIssueRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[CredentialIssueResponseData]:
    """Issue a new credential for a student. Returns raw_token ONCE for encoding/printing."""
    cred_record, raw_token = CredentialService.issue_credential(
        conn=conn,
        student_id=student_id,
        credential_type=payload.credential_type,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(
        data=CredentialIssueResponseData(
            credential=CredentialPublic.model_validate(cred_record),
            raw_token=raw_token,
        )
    )


@router.post(
    "/students/{student_id}/credentials/replace",
    response_model=ResponseEnvelope[CredentialIssueResponseData],
)
def replace_credential(
    student_id: str,
    payload: CredentialIssueRequest,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[CredentialIssueResponseData]:
    """Replace an existing credential without altering the student's identity (FR-ID-08)."""
    new_cred, raw_token = CredentialService.replace_credential(
        conn=conn,
        student_id=student_id,
        credential_type=payload.credential_type,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(
        data=CredentialIssueResponseData(
            credential=CredentialPublic.model_validate(new_cred),
            raw_token=raw_token,
        )
    )


@router.post(
    "/credentials/{credential_id}/revoke", response_model=ResponseEnvelope[dict]
)
def revoke_credential(
    credential_id: str,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[dict]:
    """Revoke an active credential immediately."""
    success = CredentialService.revoke_credential(
        conn=conn,
        credential_id=credential_id,
        teacher_id=current_teacher["teacher_id"],
    )
    return ResponseEnvelope(data={"revoked": success})


@router.post("/credentials/printable-qr")
def generate_printable_qr(
    payload: CredentialPrintQRRequest,
    _: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> Response:
    """Render an in-memory 300x300 PNG image of the opaque QR token for immediate printing.

    Privacy Guarantee: Never writes the raw token or image to disk.
    """
    png_bytes = CredentialService.generate_qr_png_bytes(payload.raw_token)
    return RawResponse(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )
