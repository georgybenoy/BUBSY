"""Repository for achievements table."""

import sqlite3
import uuid
from typing import Any


class AchievementsRepository:
    """Data-access methods for Bubsy badges and achievements."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        name: str,
        description: str,
        criteria_json: str,
        is_active: int = 1,
        achievement_id: str | None = None,
    ) -> dict[str, Any]:
        """Define a new badge or achievement."""
        aid = achievement_id or str(uuid.uuid4())
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO achievements (achievement_id, name, description, criteria_json, is_active)
            VALUES (?, ?, ?, ?, ?);
            """,
            (aid, name, description, criteria_json, is_active),
        )
        return {
            "achievement_id": aid,
            "name": name,
            "description": description,
            "criteria_json": criteria_json,
            "is_active": is_active,
        }

    @staticmethod
    def get_by_id(
        conn: sqlite3.Connection, achievement_id: str
    ) -> dict[str, Any] | None:
        """Fetch achievement by ID."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM achievements WHERE achievement_id = ?;", (achievement_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def list_active(conn: sqlite3.Connection) -> list[dict[str, Any]]:
        """List all active achievements."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM achievements WHERE is_active = 1 ORDER BY name ASC;"
        )
        return [dict(row) for row in cursor.fetchall()]
