"""Repository for student_achievements table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


class StudentAchievementsRepository:
    """Data-access methods for badges awarded to students."""

    @staticmethod
    def award_badge(
        conn: sqlite3.Connection,
        student_id: str,
        achievement_id: str,
        source_key: str | None = None,
        student_achievement_id: str | None = None,
    ) -> dict[str, Any]:
        """Award a badge to a student idempotently using source_key."""
        sa_id = student_achievement_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO student_achievements (student_achievement_id, student_id, achievement_id, awarded_at, source_key)
            VALUES (?, ?, ?, ?, ?);
            """,
            (sa_id, student_id, achievement_id, now, source_key),
        )
        return {
            "student_achievement_id": sa_id,
            "student_id": student_id,
            "achievement_id": achievement_id,
            "awarded_at": now,
            "source_key": source_key,
        }

    @staticmethod
    def list_by_student(
        conn: sqlite3.Connection, student_id: str
    ) -> list[dict[str, Any]]:
        """List all achievements awarded to a student with badge details."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT sa.*, a.name, a.description
            FROM student_achievements sa
            JOIN achievements a ON sa.achievement_id = a.achievement_id
            WHERE sa.student_id = ?
            ORDER BY sa.awarded_at DESC;
            """,
            (student_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
