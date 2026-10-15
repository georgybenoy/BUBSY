"""NFC / RFID Credential reader interface and null provider.

Per PRD section 7.1 (FR-ID-02, FR-ID-03) and Phase 7 specifications:
- Defines an abstract CredentialReader interface.
- Provides a NullCredentialReader / disabled provider for when NFC hardware is not connected.
- Ensures kiosk and QR workflows function normally when NFC is not configured.
"""

from abc import ABC, abstractmethod
from typing import Any


class CredentialReader(ABC):
    """Abstract interface for optional NFC/RFID card readers."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if reader hardware is connected and operational."""

    @abstractmethod
    def read_credential(self) -> str | None:
        """Poll or read tapped credential token string, or None if no card present."""

    @abstractmethod
    def get_status(self) -> dict[str, Any]:
        """Return diagnostic status information for teacher/operator dashboard."""


class NullCredentialReader(CredentialReader):
    """Default fallback provider when no physical NFC reader is configured."""

    def is_available(self) -> bool:
        return False

    def read_credential(self) -> str | None:
        return None

    def get_status(self) -> dict[str, Any]:
        return {
            "configured": False,
            "status": "not configured",
            "type": "NFC/RFID",
            "device": None,
        }
