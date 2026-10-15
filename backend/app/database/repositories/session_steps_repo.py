"""Repository for session_steps table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

StepResult = Literal["recognized", "retry", "uncertain", "skipped"]


class SessionStepsRepository:
    """Data-access methods for aggregate session step evaluations."""

    @staticmethod
    def record_step(
        conn: sqlite3.Connection,
        session_id: str,
        step_code: str,
        sequence_index: int,
        result: StepResult,
        duration_ms: int | None = None,
        confidence_summary: float | None = None,
        session_step_id: str | None = None,
    ) -> dict[str, Any]:
        """Record an evaluated step outcome.

        Privacy rule: stores only aggregate timing and result code; no frames or videos.
        """
        step_id = session_step_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO session_steps (
                session_step_id, session_id, step_code, sequence_index,
                result, duration_ms, confidence_summary, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                step_id,
                session_id,
                step_code,
                sequence_index,
                result,
                duration_ms,
                confidence_summary,
                now,
            ),
        )
        return {
            "session_step_id": step_id,
            "session_id": session_id,
            "step_code": step_code,
            "sequence_index": sequence_index,
            "result": result,
            "duration_ms": duration_ms,
            "confidence_summary": confidence_summary,
            "created_at": now,
        }

    @staticmethod
    def list_by_session(
        conn: sqlite3.Connection, session_id: str
    ) -> list[dict[str, Any]]:
        """Fetch all step events for a session in sequence order."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM session_steps
            WHERE session_id = ?
            ORDER BY sequence_index ASC;
            """,
            (session_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
