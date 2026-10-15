"""Repository for reward_transactions table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


class RewardTransactionsRepository:
    """Data-access methods for auditable reward points transactions."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        student_id: str,
        points_delta: int,
        reason_code: str,
        session_id: str | None = None,
        idempotency_key: str | None = None,
        created_by_teacher_id: str | None = None,
        notes: str | None = None,
        transaction_id: str | None = None,
    ) -> dict[str, Any]:
        """Record an immutable reward transaction."""
        tid = transaction_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO reward_transactions (
                transaction_id, student_id, session_id, points_delta,
                reason_code, idempotency_key, created_by_teacher_id,
                created_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                tid,
                student_id,
                session_id,
                points_delta,
                reason_code,
                idempotency_key,
                created_by_teacher_id,
                now,
                notes,
            ),
        )
        return {
            "transaction_id": tid,
            "student_id": student_id,
            "session_id": session_id,
            "points_delta": points_delta,
            "reason_code": reason_code,
            "idempotency_key": idempotency_key,
            "created_by_teacher_id": created_by_teacher_id,
            "created_at": now,
            "notes": notes,
        }

    @staticmethod
    def get_by_id(
        conn: sqlite3.Connection, transaction_id: str
    ) -> dict[str, Any] | None:
        """Fetch transaction by primary key."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM reward_transactions WHERE transaction_id = ?;",
            (transaction_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_by_idempotency_key(
        conn: sqlite3.Connection, key: str
    ) -> dict[str, Any] | None:
        """Fetch transaction by unique idempotency key."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM reward_transactions WHERE idempotency_key = ?;", (key,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_student_points_summary(
        conn: sqlite3.Connection,
        student_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> int:
        """Calculate net points for a student within an optional date window."""
        cursor = conn.cursor()
        query = "SELECT COALESCE(SUM(points_delta), 0) FROM reward_transactions WHERE student_id = ?"
        params: list[Any] = [student_id]

        if start_date:
            query += " AND created_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND created_at <= ?"
            params.append(end_date)

        cursor.execute(query, params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0

    @staticmethod
    def list_by_student(
        conn: sqlite3.Connection,
        student_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List transactions for an individual student."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM reward_transactions
            WHERE student_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?;
            """,
            (student_id, limit, offset),
        )
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def list_filtered(
        conn: sqlite3.Connection,
        student_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List reward transactions joining student names."""
        query = """
            SELECT
                rt.transaction_id,
                rt.student_id,
                st.display_name AS student_name,
                rt.session_id,
                rt.points_delta,
                rt.reason_code,
                rt.idempotency_key,
                rt.created_by_teacher_id,
                rt.created_at,
                rt.notes
            FROM reward_transactions rt
            LEFT JOIN students st ON rt.student_id = st.student_id
            WHERE 1=1
        """
        params: list[Any] = []
        if student_id:
            query += " AND rt.student_id = ?"
            params.append(student_id)
        if start_date:
            query += " AND rt.created_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND rt.created_at <= ?"
            params.append(end_date)

        query += " ORDER BY rt.created_at DESC LIMIT ? OFFSET ?;"
        params.extend([limit, offset])

        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def count_filtered(
        conn: sqlite3.Connection,
        student_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> int:
        """Count reward transactions matching filters."""
        query = "SELECT COUNT(*) FROM reward_transactions WHERE 1=1"
        params: list[Any] = []
        if student_id:
            query += " AND student_id = ?"
            params.append(student_id)
        if start_date:
            query += " AND created_at >= ?"
            params.append(start_date)
        if end_date:
            query += " AND created_at <= ?"
            params.append(end_date)

        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return int(row[0]) if row else 0
