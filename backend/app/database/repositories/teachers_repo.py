"""Repository for teachers table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

TeacherRole = Literal["admin", "teacher", "operator"]


class TeachersRepository:
    """Data-access methods for teacher and administrator accounts."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        username: str,
        password_hash: str,
        role: TeacherRole,
        is_active: int = 1,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new staff account."""
        tid = teacher_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO teachers (teacher_id, username, password_hash, role, is_active, created_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL);
            """,
            (tid, username, password_hash, role, is_active, now),
        )
        return {
            "teacher_id": tid,
            "username": username,
            "role": role,
            "is_active": is_active,
            "created_at": now,
            "last_login_at": None,
        }

    @staticmethod
    def get_by_id(conn: sqlite3.Connection, teacher_id: str) -> dict[str, Any] | None:
        """Fetch teacher account by ID."""
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM teachers WHERE teacher_id = ?;", (teacher_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_by_username(
        conn: sqlite3.Connection, username: str
    ) -> dict[str, Any] | None:
        """Fetch teacher account by login username."""
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM teachers WHERE username = ?;", (username,))
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def update_last_login(conn: sqlite3.Connection, teacher_id: str) -> bool:
        """Record login timestamp upon authentication."""
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE teachers SET last_login_at = ? WHERE teacher_id = ?;",
            (now, teacher_id),
        )
        return cursor.rowcount > 0

    @staticmethod
    def set_active_status(
        conn: sqlite3.Connection, teacher_id: str, is_active: int
    ) -> bool:
        """Update teacher active status (1 for active, 0 for disabled)."""
        if is_active not in (0, 1):
            raise ValueError("is_active must be 0 or 1")
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE teachers SET is_active = ? WHERE teacher_id = ?;",
            (is_active, teacher_id),
        )
        return cursor.rowcount > 0

    @staticmethod
    def update_password_hash(
        conn: sqlite3.Connection, teacher_id: str, new_password_hash: str
    ) -> bool:
        """Update password hash for a teacher."""
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE teachers SET password_hash = ? WHERE teacher_id = ?;",
            (new_password_hash, teacher_id),
        )
        return cursor.rowcount > 0

    @staticmethod
    def list_all(conn: sqlite3.Connection) -> list[dict[str, Any]]:
        """List all teacher accounts."""
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM teachers ORDER BY created_at ASC;")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
