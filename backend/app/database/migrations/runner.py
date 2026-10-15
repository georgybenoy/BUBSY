"""SQLite migration runner for Bubsy.

Applies versioned SQL scripts in order and records applied versions in schema_migrations.
Guaranteed to never drop or recreate an existing database.
"""

import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from app.core.logging import logger
from app.database.connection import create_connection

MIGRATIONS_DIR = Path(__file__).parent


def ensure_migration_table(conn: sqlite3.Connection) -> None:
    """Ensure the schema_migrations tracking table exists."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        """
    )
    conn.commit()


def get_applied_versions(conn: sqlite3.Connection) -> set[int]:
    """Return a set of migration versions that have already been applied."""
    ensure_migration_table(conn)
    cursor = conn.cursor()
    cursor.execute("SELECT version FROM schema_migrations ORDER BY version ASC;")
    rows = cursor.fetchall()
    return {row[0] for row in rows}


def get_available_migrations() -> list[tuple[int, str, Path]]:
    """Discover all versioned *.sql files in the migrations directory."""
    migrations = []
    pattern = re.compile(r"^(\d+)_([a-zA-Z0-9_\-]+)\.sql$")

    for file_path in MIGRATIONS_DIR.glob("*.sql"):
        match = pattern.match(file_path.name)
        if match:
            version = int(match.group(1))
            name = match.group(2)
            migrations.append((version, name, file_path))

    migrations.sort(key=lambda item: item[0])
    return migrations


def run_migrations(
    db_path: str | None = None, conn: sqlite3.Connection | None = None
) -> list[int]:
    """Execute all pending migrations against the target database.

    Never drops or recreates existing tables. Idempotent when up to date.
    """
    should_close = False
    if conn is None:
        conn = create_connection(db_path)
        should_close = True
    applied_now: list[int] = []

    try:
        ensure_migration_table(conn)
        applied = get_applied_versions(conn)
        available = get_available_migrations()

        for version, name, script_path in available:
            if version in applied:
                continue

            logger.info("Applying migration %04d_%s...", version, name)
            sql_content = script_path.read_text(encoding="utf-8")

            # Execute migration script inside a transaction
            try:
                conn.execute("BEGIN IMMEDIATE;")
                conn.executescript(sql_content)
                now_utc = datetime.now(UTC).isoformat()
                conn.execute(
                    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);",
                    (version, name, now_utc),
                )
                conn.commit()
                applied_now.append(version)
                logger.info("Migration %04d_%s applied successfully.", version, name)
            except Exception as exc:
                conn.rollback()
                logger.error(
                    "Failed to apply migration %04d_%s: %s", version, name, exc
                )
                raise RuntimeError(
                    f"Migration {version:04d}_{name} failed: {exc}"
                ) from exc

        return applied_now
    finally:
        if should_close:
            conn.close()
