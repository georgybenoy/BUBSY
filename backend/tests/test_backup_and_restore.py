"""Automated integration test for SQLite online backup and verified restore."""

import sqlite3
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.database.connection import create_connection, transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.students_repo import StudentsRepository
from backup_db import backup_database
from restore_db import restore_database


def test_backup_and_restore_workflow(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test full cycle: seed data -> atomic backup -> mutate db -> restore -> verify original data."""
    test_db = tmp_path / "bubsy_test.db"
    backup_dir = tmp_path / "backups"

    # Configure DATABASE_URL to point to test_db
    monkeypatch.setattr("app.core.config.settings.DATABASE_URL", f"sqlite:///{test_db}")

    # 1. Initialize schema and seed known records
    conn = create_connection(str(test_db))
    run_migrations(str(test_db))

    with transaction(conn):
        cls_data = ClassesRepository.create(
            conn, name="Test Class 1", academic_year="2026-2027", grade="1"
        )
        student_data = StudentsRepository.create(
            conn,
            display_name="Maya Angelou",
            class_id=cls_data["class_id"],
            school_student_code="STU-BACKUP-01",
        )
    conn.close()

    # 2. Create online atomic backup
    backup_file = backup_database(destination_dir=backup_dir)
    assert backup_file.exists()
    assert backup_file.stat().st_size > 0

    # 3. Mutate live database (add new student and delete class)
    conn2 = create_connection(str(test_db))
    with transaction(conn2):
        StudentsRepository.create(
            conn2,
            display_name="New Mutation Student",
            class_id=cls_data["class_id"],
            school_student_code="STU-MUTATED",
        )
    cur = conn2.cursor()
    cur.execute("SELECT COUNT(*) FROM students;")
    count_mutated = cur.fetchone()[0]
    assert count_mutated == 2
    conn2.close()

    # 4. Restore database from backup
    restore_database(backup_file)

    # 5. Verify restored database has original data and no mutations
    conn_restored = create_connection(str(test_db))
    r_cur = conn_restored.cursor()
    r_cur.execute("SELECT COUNT(*) FROM students;")
    restored_count = r_cur.fetchone()[0]
    assert restored_count == 1

    r_cur.execute("SELECT display_name FROM students WHERE school_student_code = 'STU-BACKUP-01';")
    row = r_cur.fetchone()
    assert row is not None
    assert row[0] == "Maya Angelou"

    # Mutated student should not exist in restored database
    r_cur.execute("SELECT COUNT(*) FROM students WHERE school_student_code = 'STU-MUTATED';")
    assert r_cur.fetchone()[0] == 0
    conn_restored.close()
