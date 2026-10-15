"""Repository for audit_events table.

Audits sensitive administrative events. Contains no passwords, credential secrets, or image data.
"""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


class AuditEventsRepository:
    """Data-access methods for security and administrative audit logging."""

    @staticmethod
    def log(
        conn: sqlite3.Connection,
        action: str,
        entity_type: str,
        entity_id: str,
        teacher_id: str | None = None,
        details_json: str | None = None,
        audit_event_id: str | None = None,
    ) -> dict[str, Any]:
        """Insert an auditable system event."""
        eid = audit_event_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_events (audit_event_id, teacher_id, action, entity_type, entity_id, timestamp, details_json)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (eid, teacher_id, action, entity_type, entity_id, now, details_json),
        )
        return {
            "audit_event_id": eid,
            "teacher_id": teacher_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "timestamp": now,
            "details_json": details_json,
        }

    @staticmethod
    def list_events(
        conn: sqlite3.Connection,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List audit events in reverse chronological order."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM audit_events
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?;
            """,
            (limit, offset),
        )
        return [dict(row) for row in cursor.fetchall()]
