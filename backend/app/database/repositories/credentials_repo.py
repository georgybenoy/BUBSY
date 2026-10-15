"""Repository for credentials table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

CredentialType = Literal["QR", "NFC"]


class CredentialsRepository:
    """Data-access methods for student QR and NFC credentials."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        student_id: str,
        credential_type: CredentialType,
        credential_hash: str,
        is_active: int = 1,
        credential_id: str | None = None,
    ) -> dict[str, Any]:
        """Store an opaque credential token lookup hash."""
        cid = credential_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO credentials (credential_id, student_id, credential_type, credential_hash, is_active, created_at, revoked_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL);
            """,
            (cid, student_id, credential_type, credential_hash, is_active, now),
        )
        return {
            "credential_id": cid,
            "student_id": student_id,
            "credential_type": credential_type,
            "credential_hash": credential_hash,
            "is_active": is_active,
            "created_at": now,
            "revoked_at": None,
        }

    @staticmethod
    def get_by_id(
        conn: sqlite3.Connection, credential_id: str
    ) -> dict[str, Any] | None:
        """Fetch a credential record by its internal UUID."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM credentials WHERE credential_id = ?;", (credential_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_by_hash(
        conn: sqlite3.Connection, credential_hash: str
    ) -> dict[str, Any] | None:
        """Resolve a scanned credential hash to its credential record."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM credentials WHERE credential_hash = ?;", (credential_hash,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_active_by_student_and_type(
        conn: sqlite3.Connection, student_id: str, credential_type: CredentialType
    ) -> dict[str, Any] | None:
        """Fetch currently active credential of a given type for a student."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM credentials
            WHERE student_id = ? AND credential_type = ? AND is_active = 1
            ORDER BY created_at DESC LIMIT 1;
            """,
            (student_id, credential_type),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def list_by_student(
        conn: sqlite3.Connection, student_id: str
    ) -> list[dict[str, Any]]:
        """List all credentials registered for a student."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM credentials WHERE student_id = ? ORDER BY created_at DESC;",
            (student_id,),
        )
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def revoke(conn: sqlite3.Connection, credential_id: str) -> bool:
        """Revoke a credential immediately."""
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE credentials SET is_active = 0, revoked_at = ? WHERE credential_id = ?;",
            (now, credential_id),
        )
        return cursor.rowcount > 0

    @staticmethod
    def revoke_all_active_by_student_and_type(
        conn: sqlite3.Connection, student_id: str, credential_type: CredentialType
    ) -> int:
        """Revoke all active credentials of a given type for a student."""
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE credentials
            SET is_active = 0, revoked_at = ?
            WHERE student_id = ? AND credential_type = ? AND is_active = 1;
            """,
            (now, student_id, credential_type),
        )
        return cursor.rowcount
