"""Service for querying monthly leaderboards and applying compensating point corrections."""

import math
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from app.database.connection import transaction
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.settings_repo import SettingsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.services.leaderboard_service import (
    LeaderboardEntry,
    compute_leaderboard_ranks,
    compute_period_key,
    get_month_utc_bounds,
)


def query_leaderboard(
    conn: sqlite3.Connection,
    month: str | None = None,
    class_id: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> dict[str, Any]:
    """Retrieve and rank students for the monthly Bubsy Champion competition.

    Invariants:
    1. Implements FR-LEAD-01 to FR-LEAD-04 tie-breaking hierarchy.
    2. Respects school's configured timezone for month boundaries.
    3. Excludes inactive students.
    """
    tz_name = SettingsRepository.get(conn, "school_timezone", "UTC") or "UTC"
    period_key = month if month else compute_period_key(datetime.now(UTC), tz_name)
    start_utc, end_utc = get_month_utc_bounds(period_key, tz_name)

    safe_page = max(1, page)
    safe_limit = min(max(1, limit), 100)

    class_filter_sql = " AND st.class_id = ?" if class_id else ""
    params: list[Any] = [start_utc, end_utc]
    if class_id:
        params.append(class_id)

    cursor = conn.cursor()
    cursor.execute(
        f"""
        SELECT
            st.student_id,
            st.display_name,
            st.school_student_code AS student_code,
            st.class_id,
            c.name AS class_name,
            COALESCE(SUM(rt.points_delta), 0) AS total_points,
            COUNT(DISTINCT CASE WHEN s.outcome = 'completed' AND s.qualifies_for_points = 1 THEN s.session_id END) AS qualifying_washes,
            COUNT(DISTINCT SUBSTR(s.started_at, 1, 10)) AS qualifying_days
        FROM students st
        JOIN classes c ON st.class_id = c.class_id
        LEFT JOIN reward_transactions rt ON st.student_id = rt.student_id
            AND rt.created_at >= ?
            AND rt.created_at < ?
        LEFT JOIN sessions s ON rt.session_id = s.session_id
        WHERE st.is_active = 1
          {class_filter_sql}
        GROUP BY st.student_id, st.display_name, st.school_student_code, st.class_id, c.name;
        """,
        params,
    )
    raw_rows = cursor.fetchall()

    # Map to entries for tie-breaking ranking calculation
    entries = [
        LeaderboardEntry(
            student_id=r["student_id"],
            display_name=r["display_name"],
            total_points=max(0, int(r["total_points"] or 0)),
            avg_technique_score=100.0,
            qualifying_days_count=int(r["qualifying_days"] or 0),
        )
        for r in raw_rows
    ]

    # Rank all qualifying entries
    ranked_entries = compute_leaderboard_ranks(entries)

    # Build lookup map by student_id for quick enrichment
    row_map = {r["student_id"]: r for r in raw_rows}

    # Slice for requested pagination window
    total = len(ranked_entries)
    offset = (safe_page - 1) * safe_limit
    paginated_entries = ranked_entries[offset : offset + safe_limit]

    items = []
    for e in paginated_entries:
        r = row_map[e.student_id]
        items.append(
            {
                "rank": e.rank,
                "student_id": e.student_id,
                "display_name": e.display_name,
                "student_code": r["student_code"],
                "class_id": r["class_id"],
                "class_name": r["class_name"],
                "total_points": e.total_points,
                "qualifying_washes": int(r["qualifying_washes"] or 0),
                "avg_technique_score": e.avg_technique_score,
            }
        )

    total_pages = math.ceil(total / safe_limit) if total > 0 else 0

    return {
        "items": items,
        "month": period_key,
        "timezone": tz_name,
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
        "total_pages": total_pages,
    }


def list_point_transactions(
    conn: sqlite3.Connection,
    student_id: str | None = None,
    month: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> dict[str, Any]:
    """List historical point transactions with pagination."""
    tz_name = SettingsRepository.get(conn, "school_timezone", "UTC") or "UTC"
    start_utc = None
    end_utc = None
    if month:
        start_utc, end_utc = get_month_utc_bounds(month, tz_name)

    safe_page = max(1, page)
    safe_limit = min(max(1, limit), 100)
    offset = (safe_page - 1) * safe_limit

    total = RewardTransactionsRepository.count_filtered(
        conn,
        student_id=student_id,
        start_date=start_utc,
        end_date=end_utc,
    )
    raw_rows = RewardTransactionsRepository.list_filtered(
        conn,
        student_id=student_id,
        start_date=start_utc,
        end_date=end_utc,
        limit=safe_limit,
        offset=offset,
    )

    items = [
        {
            "transaction_id": r["transaction_id"],
            "student_id": r["student_id"],
            "student_name": r["student_name"] or "Student",
            "session_id": r["session_id"],
            "points_delta": int(r["points_delta"]),
            "reason_code": r["reason_code"],
            "created_at": r["created_at"],
            "notes": r["notes"],
            "created_by_teacher_id": r["created_by_teacher_id"],
        }
        for r in raw_rows
    ]

    total_pages = math.ceil(total / safe_limit) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "limit": safe_limit,
        "total_pages": total_pages,
    }


def create_point_correction(
    conn: sqlite3.Connection,
    student_id: str,
    points_delta: int,
    reason: str,
    teacher_id: str,
    notes: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Create an audited compensating transaction to correct student points.

    Invariants:
    1. Historical transactions are NEVER mutated or deleted.
    2. Uses compensating delta (+ or -).
    3. Idempotent key generated per adjustment.
    4. Audited in audit_events table.
    """
    if points_delta == 0:
        raise ValueError("points_delta cannot be zero")

    student = StudentsRepository.get_by_id(conn, student_id)
    if not student:
        raise ValueError("Student not found")

    idempotency_key = f"manual_correction:{student_id}:{teacher_id}:{uuid.uuid4()}"
    full_notes = f"{reason.strip()}"
    if notes and notes.strip():
        full_notes += f" — {notes.strip()}"

    with transaction(conn) as tx:
        record = RewardTransactionsRepository.create(
            tx,
            student_id=student_id,
            points_delta=points_delta,
            reason_code="TEACHER_CORRECTION",
            session_id=session_id,
            idempotency_key=idempotency_key,
            created_by_teacher_id=teacher_id,
            notes=full_notes,
        )

        # Audit event
        audit_id = str(uuid.uuid4())
        now_iso = datetime.now(UTC).isoformat()
        cursor = tx.cursor()
        cursor.execute(
            """
            INSERT INTO audit_events (
                audit_event_id, teacher_id, action, entity_type, entity_id, timestamp, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                audit_id,
                teacher_id,
                "POINT_CORRECTION",
                "student",
                student_id,
                now_iso,
                f'{{"points_delta": {points_delta}, "reason": "{reason}", "transaction_id": "{record["transaction_id"]}"}}',
            ),
        )

    return record
