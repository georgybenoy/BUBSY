"""Verified SQLite database restore script for Bubsy.

Steps:
1. Validates source backup file integrity using PRAGMA integrity_check.
2. Checks that schema migrations table is present.
3. Automatically creates a safety pre-restore backup of the target database.
4. Performs an atomic restore.
5. Verifies foreign keys and integrity on the restored target database.
"""

import argparse
import os
import shutil
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.core.config import settings
from app.database.connection import resolve_db_path


def restore_database(backup_file: Path) -> None:
    """Restore Bubsy SQLite database from a verified backup file."""
    if not backup_file.is_file():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    target_path = Path(resolve_db_path(settings.DATABASE_URL))

    # 1. Validate backup file integrity
    check_conn = sqlite3.connect(str(backup_file))
    cur = check_conn.cursor()
    cur.execute("PRAGMA integrity_check;")
    check_status = cur.fetchone()[0]
    if check_status != "ok":
        check_conn.close()
        raise RuntimeError(f"Backup file is corrupted (integrity_check returned: {check_status})")

    # Check for schema_migrations table
    cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations';")
    if cur.fetchone()[0] == 0:
        check_conn.close()
        raise RuntimeError("Backup file does not contain a valid Bubsy schema (missing schema_migrations table).")
    check_conn.close()

    # 2. Safety copy of current live database if it exists
    if target_path.exists():
        safety_dir = REPO_ROOT / "backups" / "pre_restore_safety"
        safety_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        safety_copy = safety_dir / f"bubsy_before_restore_{ts}.db"

        # Online copy of current db
        live_conn = sqlite3.connect(str(target_path))
        safe_conn = sqlite3.connect(str(safety_copy))
        with safe_conn:
            live_conn.backup(safe_conn)
        safe_conn.close()
        live_conn.close()
        print(f"Safety snapshot saved to: {safety_copy}")

    # 3. Perform atomic restore via SQLite backup API
    target_path.parent.mkdir(parents=True, exist_ok=True)
    src_conn = sqlite3.connect(str(backup_file))
    dst_conn = sqlite3.connect(str(target_path))

    with dst_conn:
        src_conn.backup(dst_conn)

    src_conn.close()
    dst_conn.close()

    # 4. Verify restored target database
    restored_conn = sqlite3.connect(str(target_path))
    r_cur = restored_conn.cursor()
    r_cur.execute("PRAGMA integrity_check;")
    r_status = r_cur.fetchone()[0]
    r_cur.execute("PRAGMA foreign_key_check;")
    fk_violations = r_cur.fetchall()
    restored_conn.close()

    if r_status != "ok" or fk_violations:
        raise RuntimeError(f"Restored database verification failed! status={r_status}, fk_violations={fk_violations}")

    print(f"SUCCESS: Successfully restored database from {backup_file} to {target_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restore Bubsy SQLite database.")
    parser.add_argument("backup_file", type=Path, help="Path to backup database file")
    args = parser.parse_args()

    try:
        restore_database(args.backup_file)
    except Exception as exc:
        print(f"ERROR: Restore failed: {exc}", file=sys.stderr)
        sys.exit(1)
