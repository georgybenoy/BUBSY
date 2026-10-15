"""Repository for classes table."""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


class ClassesRepository:
    """Data-access methods for school classes."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        name: str,
        academic_year: str,
        grade: str | None = None,
        is_active: int = 1,
        class_id: str | None = None,
    ) -> dict[str, Any]:
        """Insert a new class."""
        cid = class_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO classes (class_id, name, grade, academic_year, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (cid, name, grade, academic_year, is_active, now, now),
        )
        return {
            "class_id": cid,
            "name": name,
            "grade": grade,
            "academic_year": academic_year,
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def get_by_id(conn: sqlite3.Connection, class_id: str) -> dict[str, Any] | None:
        """Fetch a class by primary key."""
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM classes WHERE class_id = ?;", (class_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_by_name_and_year(
        conn: sqlite3.Connection, name: str, academic_year: str
    ) -> dict[str, Any] | None:
        """Fetch a class by unique name and academic year combination."""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM classes WHERE name = ? AND academic_year = ?;",
            (name, academic_year),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def update(
        conn: sqlite3.Connection,
        class_id: str,
        name: str | None = None,
        grade: str | None = None,
        academic_year: str | None = None,
        is_active: int | None = None,
    ) -> dict[str, Any] | None:
        """Update class attributes."""
        existing = ClassesRepository.get_by_id(conn, class_id)
        if not existing:
            return None

        new_name = name if name is not None else existing["name"]
        new_grade = grade if grade is not None else existing["grade"]
        new_year = (
            academic_year if academic_year is not None else existing["academic_year"]
        )
        new_active = is_active if is_active is not None else existing["is_active"]
        now = datetime.now(UTC).isoformat()

        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE classes
            SET name = ?, grade = ?, academic_year = ?, is_active = ?, updated_at = ?
            WHERE class_id = ?;
            """,
            (new_name, new_grade, new_year, new_active, now, class_id),
        )
        return ClassesRepository.get_by_id(conn, class_id)

    @staticmethod
    def list_all(
        conn: sqlite3.Connection, active_only: bool = True
    ) -> list[dict[str, Any]]:
        """List all classes."""
        cursor = conn.cursor()
        if active_only:
            cursor.execute(
                "SELECT * FROM classes WHERE is_active = 1 ORDER BY name ASC;"
            )
        else:
            cursor.execute("SELECT * FROM classes ORDER BY name ASC;")
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def list_classes_with_summary(
        conn: sqlite3.Connection, active_only: bool = False
    ) -> list[dict[str, Any]]:
        """List classes with aggregated metrics per DESIGN.md section 3.4."""
        query = """
        SELECT
            c.class_id,
            c.name,
            c.grade,
            c.academic_year,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(DISTINCT s.student_id) AS student_count,
            COALESCE(SUM(CASE WHEN sess.qualifies_for_points = 1 THEN 1 ELSE 0 END), 0) AS qualifying_wash_count,
            COALESCE(COUNT(sess.session_id), 0) AS total_sessions_count,
            COALESCE(SUM(CASE WHEN sess.outcome = 'completed' THEN 1 ELSE 0 END), 0) AS completed_sessions_count,
            COALESCE(SUM(rt.points_delta), 0) AS total_points
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.class_id AND s.is_active = 1
        LEFT JOIN sessions sess ON sess.student_id = s.student_id
        LEFT JOIN reward_transactions rt ON rt.student_id = s.student_id
        WHERE (? = 0 OR c.is_active = 1)
        GROUP BY c.class_id
        ORDER BY c.name ASC;
        """
        cursor = conn.cursor()
        cursor.execute(query, (1 if active_only else 0,))
        rows = cursor.fetchall()

        results = []
        for r in rows:
            data = dict(r)
            total = data.pop("total_sessions_count", 0)
            completed = data.pop("completed_sessions_count", 0)
            data["protocol_completion_rate"] = (
                round((completed / total) * 100) if total > 0 else 0
            )
            results.append(data)
        return results
