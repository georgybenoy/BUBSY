"""Repository for settings table.

Stores application configuration (school timezone, daily caps, protocol versions).
Secrets and passwords must never be stored in this table.
"""

import sqlite3
from datetime import UTC, datetime


class SettingsRepository:
    """Data-access methods for key-value application settings."""

    @staticmethod
    def get(
        conn: sqlite3.Connection, key: str, default: str | None = None
    ) -> str | None:
        """Fetch setting value by key."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT setting_value FROM settings WHERE setting_key = ?;", (key,)
        )
        row = cursor.fetchone()
        return str(row[0]) if row else default

    @staticmethod
    def set(
        conn: sqlite3.Connection,
        key: str,
        value: str,
        updated_by_teacher_id: str | None = None,
    ) -> None:
        """Upsert a setting value."""
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO settings (setting_key, setting_value, updated_at, updated_by_teacher_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = excluded.updated_at,
                updated_by_teacher_id = excluded.updated_by_teacher_id;
            """,
            (key, value, now, updated_by_teacher_id),
        )

    @staticmethod
    def get_all(conn: sqlite3.Connection) -> dict[str, str]:
        """Fetch all settings as a dictionary."""
        cursor = conn.cursor()
        cursor.execute("SELECT setting_key, setting_value FROM settings;")
        return {row["setting_key"]: row["setting_value"] for row in cursor.fetchall()}
