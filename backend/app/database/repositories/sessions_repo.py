"""Repository for sessions table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

SessionOutcome = Literal["completed", "incomplete", "uncertain", "cancelled", "error"]


class SessionsRepository:
    """Data-access methods for handwashing sessions."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        kiosk_id: str,
        protocol_version: str,
        student_id: str | None = None,
        model_version: str | None = None,
        outcome: SessionOutcome = "incomplete",
        started_at: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new session record."""
        sid = session_id or str(uuid.uuid4())
        start_time = started_at or datetime.now(UTC).isoformat()
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO sessions (
                session_id, student_id, kiosk_id, started_at, ended_at,
                duration_seconds, outcome, protocol_version, model_version,
                qualifies_for_points, failure_reason, created_at
            ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 0, NULL, ?);
            """,
            (
                sid,
                student_id,
                kiosk_id,
                start_time,
                outcome,
                protocol_version,
                model_version,
                now,
            ),
        )
        return {
            "session_id": sid,
            "student_id": student_id,
            "kiosk_id": kiosk_id,
            "started_at": start_time,
            "ended_at": None,
            "duration_seconds": None,
            "outcome": outcome,
            "protocol_version": protocol_version,
            "model_version": model_version,
            "qualifies_for_points": 0,
            "failure_reason": None,
            "created_at": now,
        }

    @staticmethod
    def get_by_id(conn: sqlite3.Connection, session_id: str) -> dict[str, Any] | None:
        """Fetch session by ID."""
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE session_id = ?;", (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def finalize_session(
        conn: sqlite3.Connection,
        session_id: str,
        ended_at: str,
        duration_seconds: int,
        outcome: SessionOutcome,
        qualifies_for_points: int,
        failure_reason: str | None = None,
    ) -> bool:
        """Update session upon completion or termination."""
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE sessions
            SET ended_at = ?,
                duration_seconds = ?,
                outcome = ?,
                qualifies_for_points = ?,
                failure_reason = ?
            WHERE session_id = ?;
            """,
            (
                ended_at,
                duration_seconds,
                outcome,
                qualifies_for_points,
                failure_reason,
                session_id,
            ),
        )
        return cursor.rowcount > 0

    @staticmethod
    def list_by_student(
        conn: sqlite3.Connection,
        student_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List sessions for a specific student."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM sessions
            WHERE student_id = ?
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?;
            """,
            (student_id, limit, offset),
        )
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def list_filtered(
        conn: sqlite3.Connection,
        start_date: str | None = None,
        end_date: str | None = None,
        class_id: str | None = None,
        student_id: str | None = None,
        outcome: str | None = None,
        kiosk_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List sessions with rich filtering and joins for teacher portal."""
        query = """
            SELECT
                s.session_id,
                s.student_id,
                st.display_name AS student_name,
                st.school_student_code AS student_code,
                st.class_id,
                c.name AS class_name,
                s.kiosk_id,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                s.outcome,
                s.protocol_version,
                s.model_version,
                s.qualifies_for_points,
                s.failure_reason,
                s.created_at,
                COALESCE((
                    SELECT SUM(rt.points_delta)
                    FROM reward_transactions rt
                    WHERE rt.session_id = s.session_id
                ), 0) AS points_awarded,
                (
                    SELECT COUNT(*)
                    FROM session_steps ss
                    WHERE ss.session_id = s.session_id AND ss.result = 'recognized'
                ) AS recognized_steps_count,
                (
                    SELECT COUNT(*)
                    FROM session_steps ss
                    WHERE ss.session_id = s.session_id
                ) AS total_steps_count
            FROM sessions s
            LEFT JOIN students st ON s.student_id = st.student_id
            LEFT JOIN classes c ON st.class_id = c.class_id
            WHERE 1=1
        """
        params: list[Any] = []
        if start_date:
            query += " AND s.started_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND s.started_at <= ?"
            params.append(end_date)
        if class_id:
            query += " AND st.class_id = ?"
            params.append(class_id)
        if student_id:
            query += " AND s.student_id = ?"
            params.append(student_id)
        if outcome:
            query += " AND s.outcome = ?"
            params.append(outcome)
        if kiosk_id:
            query += " AND s.kiosk_id = ?"
            params.append(kiosk_id)

        query += " ORDER BY s.started_at DESC LIMIT ? OFFSET ?;"
        params.extend([limit, offset])

        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def count_filtered(
        conn: sqlite3.Connection,
        start_date: str | None = None,
        end_date: str | None = None,
        class_id: str | None = None,
        student_id: str | None = None,
        outcome: str | None = None,
        kiosk_id: str | None = None,
    ) -> int:
        """Count sessions matching filters."""
        query = """
            SELECT COUNT(*)
            FROM sessions s
            LEFT JOIN students st ON s.student_id = st.student_id
            WHERE 1=1
        """
        params: list[Any] = []
        if start_date:
            query += " AND s.started_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND s.started_at <= ?"
            params.append(end_date)
        if class_id:
            query += " AND st.class_id = ?"
            params.append(class_id)
        if student_id:
            query += " AND s.student_id = ?"
            params.append(student_id)
        if outcome:
            query += " AND s.outcome = ?"
            params.append(outcome)
        if kiosk_id:
            query += " AND s.kiosk_id = ?"
            params.append(kiosk_id)

        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0

    @staticmethod
    def get_detailed_by_id(
        conn: sqlite3.Connection, session_id: str
    ) -> dict[str, Any] | None:
        """Fetch a single session with joined student, class, and points."""
        query = """
            SELECT
                s.session_id,
                s.student_id,
                st.display_name AS student_name,
                st.school_student_code AS student_code,
                st.class_id,
                c.name AS class_name,
                s.kiosk_id,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                s.outcome,
                s.protocol_version,
                s.model_version,
                s.qualifies_for_points,
                s.failure_reason,
                s.created_at,
                COALESCE((
                    SELECT SUM(rt.points_delta)
                    FROM reward_transactions rt
                    WHERE rt.session_id = s.session_id
                ), 0) AS points_awarded,
                (
                    SELECT COUNT(*)
                    FROM session_steps ss
                    WHERE ss.session_id = s.session_id AND ss.result = 'recognized'
                ) AS recognized_steps_count,
                (
                    SELECT COUNT(*)
                    FROM session_steps ss
                    WHERE ss.session_id = s.session_id
                ) AS total_steps_count
            FROM sessions s
            LEFT JOIN students st ON s.student_id = st.student_id
            LEFT JOIN classes c ON st.class_id = c.class_id
            WHERE s.session_id = ?;
        """
        cursor = conn.cursor()
        cursor.execute(query, (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
