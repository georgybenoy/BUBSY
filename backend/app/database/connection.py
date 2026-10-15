"""SQLite database connection factory and transaction manager for Bubsy.

Enforces PRAGMA foreign_keys = ON, WAL mode, busy timeout, sqlite3.Row factory,
and safe transaction context management.
"""

import os
import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


def resolve_db_path(db_url: str | Path | None = None) -> str:
    """Extract local filesystem path from a sqlite:/// URI or return as-is."""
    target_url = str(db_url) if db_url is not None else settings.DATABASE_URL
    if target_url.startswith("sqlite:///"):
        raw_path = target_url.replace("sqlite:///", "", 1)
        if raw_path == ":memory:":
            return ":memory:"
        return os.path.abspath(raw_path)
    return target_url


def create_connection(db_path: str | None = None) -> sqlite3.Connection:
    """Create a configured SQLite connection.

    Enforces foreign keys, WAL journal mode, busy timeout, and Row factory.
    """
    resolved_path = resolve_db_path(db_path)

    # Ensure parent directory exists for file-based databases
    if resolved_path != ":memory:":
        parent_dir = Path(resolved_path).parent
        parent_dir.mkdir(parents=True, exist_ok=True)

    # Use timeout to handle concurrency cleanly
    conn = sqlite3.connect(
        resolved_path,
        timeout=10.0,
        check_same_thread=False,
        detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
    )

    # Standard row factory for dictionary-style attribute access
    conn.row_factory = sqlite3.Row

    # Execute mandatory per-connection pragmas
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA busy_timeout = 5000;")
    if resolved_path != ":memory:":
        cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.close()

    return conn


@contextmanager
def get_db_connection(
    db_path: str | None = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Context manager yielding a standalone SQLite connection, closed upon exit."""
    conn = create_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaction(
    conn: sqlite3.Connection | None = None,
    db_path: str | None = None,
) -> Generator[sqlite3.Connection, None, None]:
    """Transaction context manager.

    If an existing connection is provided, wraps commands in a savepoint/transaction.
    Otherwise creates a connection and commits on successful exit or rolls back on error.
    """
    close_when_done = False
    if conn is None:
        conn = create_connection(db_path)
        close_when_done = True

    is_nested = conn.in_transaction
    sp_name = f"sp_{os.urandom(4).hex()}" if is_nested else None

    try:
        if is_nested:
            conn.execute(f"SAVEPOINT {sp_name};")
        else:
            conn.execute("BEGIN IMMEDIATE;")
        yield conn
        if is_nested:
            conn.execute(f"RELEASE SAVEPOINT {sp_name};")
        else:
            conn.commit()
    except Exception as exc:
        if is_nested:
            conn.execute(f"ROLLBACK TO SAVEPOINT {sp_name};")
        else:
            conn.rollback()
        logger.error("Transaction rolled back due to error: %s", exc)
        raise
    finally:
        if close_when_done:
            conn.close()
