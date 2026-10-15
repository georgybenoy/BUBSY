"""Schemas for credential operations."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CredentialIssueRequest(BaseModel):
    """Payload to issue a credential."""

    credential_type: Literal["QR", "NFC"] = Field(
        default="QR", description="Type of credential"
    )


class CredentialPublic(BaseModel):
    """Sanitized public credential info (contains zero raw tokens or secrets)."""

    model_config = ConfigDict(from_attributes=True)

    credential_id: str
    student_id: str
    credential_type: str
    is_active: int
    created_at: str
    revoked_at: str | None = None


class CredentialIssueResponseData(BaseModel):
    """Returned once to an authorized teacher upon issuance."""

    credential: CredentialPublic
    raw_token: str = Field(
        ...,
        description="Opaque token shown ONCE for physical printing/encoding; never persisted",
    )


class CredentialPrintQRRequest(BaseModel):
    """Request payload to render printable QR image."""

    raw_token: str = Field(
        ...,
        min_length=8,
        max_length=256,
        description="Opaque raw token to render in-memory",
    )
