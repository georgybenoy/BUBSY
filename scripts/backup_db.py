"""Atomic online SQLite backup script for Bubsy.

Uses SQLite's native backup API (sqlite3.Connection.backup) to create a safe,
consistent, point-in-time copy of the live database even when active in WAL mode.
Runs integrity checks on the generated backup file.
"""

import argparse
import os
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.core.config import settings
from app.database.connection import resolve_db_path


def backup_database(destination_dir: Path | None = None) -> Path:
    """Create an atomic backup of the Bubsy SQLite database."""
    source_path = Path(resolve_db_path(settings.DATABASE_URL))

    if not source_path.exists():
        raise FileNotFoundError(f"Source database file does not exist: {source_path}")

    dest_dir = destination_dir or (REPO_ROOT / "backups")
    dest_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_file = dest_dir / f"bubsy_backup_{timestamp}.db"

    # Open live source connection
    src_conn = sqlite3.connect(str(source_path))

    # Open backup destination connection
    dst_conn = sqlite3.connect(str(backup_file))

    # Perform online atomic backup
    with dst_conn:
        src_conn.backup(dst_conn, pages=100)

    dst_conn.close()
    src_conn.close()

    # Verify backup integrity
    verify_conn = sqlite3.connect(str(backup_file))
    cur = verify_conn.cursor()
    cur.execute("PRAGMA integrity_check;")
    status = cur.fetchone()[0]
    verify_conn.close()

    if status != "ok":
        backup_file.unlink(missing_ok=True)
        raise RuntimeError(f"Backup failed integrity check: {status}")

    print(f"SUCCESS: Created verified backup at {backup_file}")
    return backup_file


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backup Bubsy SQLite database.")
    parser.add_argument("--dest", type=Path, default=None, help="Backup destination directory")
    args = parser.parse_args()

    try:
        backup_database(args.dest)
    except Exception as exc:
        print(f"ERROR: Backup failed: {exc}", file=sys.stderr)
        sys.exit(1)
