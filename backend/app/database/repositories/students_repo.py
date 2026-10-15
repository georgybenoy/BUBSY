"""Repository for students table.

Strict privacy rule: Collects and persists ONLY school_student_code, display_name,
class_id, and is_active. Never accepts or persists date of birth, address, or parent contact.
"""

import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any


class StudentsRepository:
    """Data-access methods for students."""

    @staticmethod
    def create(
        conn: sqlite3.Connection,
        display_name: str,
        class_id: str,
        school_student_code: str | None = None,
        is_active: int = 1,
        student_id: str | None = None,
    ) -> dict[str, Any]:
        """Insert a student record without collecting prohibited sensitive attributes."""
        sid = student_id or str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO students (student_id, school_student_code, display_name, class_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (sid, school_student_code, display_name, class_id, is_active, now, now),
        )
        return {
            "student_id": sid,
            "school_student_code": school_student_code,
            "display_name": display_name,
            "class_id": class_id,
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def get_by_id(conn: sqlite3.Connection, student_id: str) -> dict[str, Any] | None:
        """Fetch student by internal UUID."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.*, c.name AS class_name
            FROM students s
            LEFT JOIN classes c ON c.class_id = s.class_id
            WHERE s.student_id = ?;
            """,
            (student_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_by_school_code(
        conn: sqlite3.Connection, code: str
    ) -> dict[str, Any] | None:
        """Fetch student by school-issued code."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.*, c.name AS class_name
            FROM students s
            LEFT JOIN classes c ON c.class_id = s.class_id
            WHERE s.school_student_code = ?;
            """,
            (code,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def update(
        conn: sqlite3.Connection,
        student_id: str,
        display_name: str | None = None,
        class_id: str | None = None,
        school_student_code: str | None = None,
        is_active: int | None = None,
    ) -> dict[str, Any] | None:
        """Update student record (preserving history and privacy)."""
        existing = StudentsRepository.get_by_id(conn, student_id)
        if not existing:
            return None

        new_name = (
            display_name if display_name is not None else existing["display_name"]
        )
        new_class_id = class_id if class_id is not None else existing["class_id"]
        new_code = (
            school_student_code
            if school_student_code is not None
            else existing["school_student_code"]
        )
        new_active = is_active if is_active is not None else existing["is_active"]
        now = datetime.now(UTC).isoformat()

        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE students
            SET display_name = ?, class_id = ?, school_student_code = ?, is_active = ?, updated_at = ?
            WHERE student_id = ?;
            """,
            (new_name, new_class_id, new_code, new_active, now, student_id),
        )
        return StudentsRepository.get_by_id(conn, student_id)

    @staticmethod
    def set_active_status(
        conn: sqlite3.Connection, student_id: str, is_active: int
    ) -> bool:
        """Soft-deactivate (0) or reactivate (1) a student account."""
        if is_active not in (0, 1):
            raise ValueError("is_active must be 0 or 1")
        now = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE students SET is_active = ?, updated_at = ? WHERE student_id = ?;",
            (is_active, now, student_id),
        )
        return cursor.rowcount > 0

    @staticmethod
    def list_by_class(
        conn: sqlite3.Connection, class_id: str, active_only: bool = True
    ) -> list[dict[str, Any]]:
        """List students assigned to a class."""
        cursor = conn.cursor()
        if active_only:
            cursor.execute(
                """
                SELECT s.*, c.name AS class_name
                FROM students s
                LEFT JOIN classes c ON c.class_id = s.class_id
                WHERE s.class_id = ? AND s.is_active = 1
                ORDER BY s.display_name ASC;
                """,
                (class_id,),
            )
        else:
            cursor.execute(
                """
                SELECT s.*, c.name AS class_name
                FROM students s
                LEFT JOIN classes c ON c.class_id = s.class_id
                WHERE s.class_id = ?
                ORDER BY s.display_name ASC;
                """,
                (class_id,),
            )
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def list_paginated_with_metrics(
        conn: sqlite3.Connection,
        page: int = 1,
        page_size: int = 20,
        class_id: str | None = None,
        is_active: int | None = None,
        search: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Fetch paginated students list with wash metrics per DESIGN.md section 3.3.

        Returns (items, total_count).
        """
        where_clauses = ["1=1"]
        params: list[Any] = []

        if class_id:
            where_clauses.append("s.class_id = ?")
            params.append(class_id)

        if is_active is not None:
            where_clauses.append("s.is_active = ?")
            params.append(is_active)

        if search and search.strip():
            term = f"%{search.strip()}%"
            where_clauses.append(
                "(s.display_name LIKE ? OR s.school_student_code LIKE ?)"
            )
            params.extend([term, term])

        where_sql = " AND ".join(where_clauses)

        # Count total matches
        count_cursor = conn.cursor()
        count_cursor.execute(
            f"SELECT COUNT(*) FROM students s WHERE {where_sql};",
            params,
        )
        total_count = count_cursor.fetchone()[0]

        # Query items with aggregated wash metrics
        limit = max(1, min(page_size, 100))
        offset = max(0, (page - 1) * limit)

        query = f"""
        SELECT
            s.student_id,
            s.school_student_code,
            s.display_name,
            s.class_id,
            c.name AS class_name,
            s.is_active,
            s.created_at,
            s.updated_at,
            COALESCE(SUM(rt.points_delta), 0) AS monthly_points,
            COALESCE(SUM(CASE WHEN sess.qualifies_for_points = 1 THEN 1 ELSE 0 END), 0) AS qualifying_washes
        FROM students s
        LEFT JOIN classes c ON c.class_id = s.class_id
        LEFT JOIN reward_transactions rt ON rt.student_id = s.student_id
        LEFT JOIN sessions sess ON sess.student_id = s.student_id
        WHERE {where_sql}
        GROUP BY s.student_id
        ORDER BY s.display_name ASC
        LIMIT ? OFFSET ?;
        """
        query_params = [*params, limit, offset]
        cursor = conn.cursor()
        cursor.execute(query, query_params)
        rows = cursor.fetchall()

        return [dict(row) for row in rows], total_count
