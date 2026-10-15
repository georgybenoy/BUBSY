"""Analytics and reporting service for trends, distributions, and sanitized CSV exports."""

import csv
import io
import sqlite3
from datetime import UTC, datetime
from typing import Any

from app.database.repositories.settings_repo import SettingsRepository
from app.services.leaderboard_service import (
    compute_local_date_str,
    compute_period_key,
    get_month_utc_bounds,
)
from app.services.wash_session_service import STEP_NAME_MAP

HYGIENE_DISCLAIMER = (
    "Note: AI technique recognition reflects protocol adherence and does not prove "
    "microbiological cleanliness or germ elimination."
)


def sanitize_csv_cell(value: Any) -> str:
    """Sanitize string values against CSV/formula injection (=, +, -, @, tab, CR)."""
    if value is None:
        return ""
    val_str = str(value).strip()
    if val_str and val_str[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{val_str}"
    return val_str


def get_analytics_data(
    conn: sqlite3.Connection,
    period: str | None = None,
    class_id: str | None = None,
) -> dict[str, Any]:
    """Calculate daily/monthly trends, class completion, distribution, and step difficulty."""
    tz_name = SettingsRepository.get(conn, "school_timezone", "UTC") or "UTC"

    if not period or period == "current_month":
        period_key = compute_period_key(datetime.now(UTC), tz_name)
    else:
        period_key = period

    start_utc, end_utc = get_month_utc_bounds(period_key, tz_name)

    cursor = conn.cursor()

    # 1. Daily trends in period
    class_filter_sql = " AND st.class_id = ?" if class_id else ""
    params_base: list[Any] = [start_utc, end_utc]
    if class_id:
        params_base.append(class_id)

    cursor.execute(
        f"""
        SELECT
            s.started_at,
            s.outcome,
            s.qualifies_for_points
        FROM sessions s
        LEFT JOIN students st ON s.student_id = st.student_id
        WHERE s.started_at >= ?
          AND s.started_at < ?
          {class_filter_sql}
        ORDER BY s.started_at ASC;
        """,
        params_base,
    )
    daily_map: dict[str, dict[str, int]] = {}
    for r in cursor.fetchall():
        local_date = compute_local_date_str(r["started_at"], tz_name)
        if local_date not in daily_map:
            daily_map[local_date] = {"total": 0, "qualifying": 0}
        daily_map[local_date]["total"] += 1
        if r["outcome"] == "completed" and r["qualifies_for_points"] == 1:
            daily_map[local_date]["qualifying"] += 1

    daily_trends = []
    for d, data in sorted(daily_map.items()):
        rate = (
            round((data["qualifying"] / data["total"]) * 100.0, 1)
            if data["total"] > 0
            else 0.0
        )
        daily_trends.append(
            {
                "date": d,
                "total_sessions": data["total"],
                "qualifying_sessions": data["qualifying"],
                "completion_rate": rate,
            }
        )

    # 2. Monthly trends (recent 6 months)
    cursor.execute(
        """
        SELECT
            s.started_at,
            s.outcome,
            s.qualifies_for_points
        FROM sessions s
        ORDER BY s.started_at ASC;
        """
    )
    month_map: dict[str, dict[str, int]] = {}
    for r in cursor.fetchall():
        m_key = compute_period_key(r["started_at"], tz_name)
        if m_key not in month_map:
            month_map[m_key] = {"total": 0, "qualifying": 0}
        month_map[m_key]["total"] += 1
        if r["outcome"] == "completed" and r["qualifies_for_points"] == 1:
            month_map[m_key]["qualifying"] += 1

    # Take the last 6 months
    sorted_months = sorted(month_map.items())[-6:]
    monthly_trends = [
        {
            "month": m,
            "total_sessions": data["total"],
            "qualifying_sessions": data["qualifying"],
        }
        for m, data in sorted_months
    ]

    # 3. Protocol completion by class (normalized by class size)
    cursor.execute(
        """
        SELECT
            c.class_id,
            c.name AS class_name,
            COUNT(DISTINCT st.student_id) AS student_count,
            COUNT(DISTINCT CASE WHEN s.outcome = 'completed' AND s.qualifies_for_points = 1 THEN s.session_id END) AS qualifying_washes,
            COUNT(DISTINCT s.session_id) AS total_sessions
        FROM classes c
        LEFT JOIN students st ON c.class_id = st.class_id AND st.is_active = 1
        LEFT JOIN sessions s ON st.student_id = s.student_id
            AND s.started_at >= ?
            AND s.started_at < ?
        WHERE c.is_active = 1
        GROUP BY c.class_id, c.name
        ORDER BY c.name ASC;
        """,
        (start_utc, end_utc),
    )
    completion_by_class = []
    for r in cursor.fetchall():
        st_count = int(r["student_count"])
        q_count = int(r["qualifying_washes"])
        t_count = int(r["total_sessions"])
        c_rate = round((q_count / t_count) * 100.0, 1) if t_count > 0 else 0.0
        w_per_student = round(q_count / st_count, 1) if st_count > 0 else 0.0
        completion_by_class.append(
            {
                "class_id": r["class_id"],
                "class_name": r["class_name"],
                "registered_students": st_count,
                "qualifying_washes": q_count,
                "completion_rate": c_rate,
                "washes_per_student": w_per_student,
            }
        )

    # 4. Participation distribution buckets (0, 1-5, 6-15, 16+)
    cursor.execute(
        f"""
        SELECT
            st.student_id,
            COUNT(DISTINCT CASE WHEN s.outcome = 'completed' AND s.qualifies_for_points = 1 THEN s.session_id END) AS wash_count
        FROM students st
        LEFT JOIN sessions s ON st.student_id = s.student_id
            AND s.started_at >= ?
            AND s.started_at < ?
        WHERE st.is_active = 1
          {class_filter_sql}
        GROUP BY st.student_id;
        """,
        params_base,
    )
    student_wash_rows = cursor.fetchall()
    total_active_students = len(student_wash_rows)

    b0 = 0
    b1_5 = 0
    b6_15 = 0
    b16_plus = 0

    for sr in student_wash_rows:
        cnt = int(sr["wash_count"])
        if cnt == 0:
            b0 += 1
        elif 1 <= cnt <= 5:
            b1_5 += 1
        elif 6 <= cnt <= 15:
            b6_15 += 1
        else:
            b16_plus += 1

    def calc_pct(count: int, total: int) -> float:
        return round((count / total) * 100.0, 1) if total > 0 else 0.0

    participation_distribution = [
        {
            "bucket_label": "0 washes",
            "student_count": b0,
            "percentage": calc_pct(b0, total_active_students),
        },
        {
            "bucket_label": "1-5 washes",
            "student_count": b1_5,
            "percentage": calc_pct(b1_5, total_active_students),
        },
        {
            "bucket_label": "6-15 washes",
            "student_count": b6_15,
            "percentage": calc_pct(b6_15, total_active_students),
        },
        {
            "bucket_label": "16+ washes",
            "student_count": b16_plus,
            "percentage": calc_pct(b16_plus, total_active_students),
        },
    ]

    # 5. Commonly missed or uncertain steps (from session_steps)
    cursor.execute(
        f"""
        SELECT
            ss.step_code,
            COUNT(*) AS total_attempts,
            COUNT(CASE WHEN ss.result = 'recognized' THEN 1 END) AS recognized_count,
            COUNT(CASE WHEN ss.result = 'uncertain' THEN 1 END) AS uncertain_count,
            COUNT(CASE WHEN ss.result = 'retry' THEN 1 END) AS retry_count,
            COUNT(CASE WHEN ss.result = 'skipped' THEN 1 END) AS skipped_count
        FROM session_steps ss
        JOIN sessions s ON ss.session_id = s.session_id
        LEFT JOIN students st ON s.student_id = st.student_id
        WHERE s.started_at >= ?
          AND s.started_at < ?
          {class_filter_sql}
        GROUP BY ss.step_code
        ORDER BY ss.step_code ASC;
        """,
        params_base,
    )
    commonly_missed_steps = []
    for sr in cursor.fetchall():
        tot = int(sr["total_attempts"])
        unc = int(sr["uncertain_count"])
        ret = int(sr["retry_count"])
        skp = int(sr["skipped_count"])
        rec = int(sr["recognized_count"])
        rate = round(((unc + ret) / tot) * 100.0, 1) if tot > 0 else 0.0
        step_name = STEP_NAME_MAP.get(sr["step_code"], sr["step_code"])
        commonly_missed_steps.append(
            {
                "step_code": sr["step_code"],
                "step_name": step_name,
                "total_attempts": tot,
                "recognized_count": rec,
                "uncertain_count": unc,
                "retry_count": ret,
                "skipped_count": skp,
                "uncertainty_rate": rate,
            }
        )

    return {
        "period": period_key,
        "disclaimer": HYGIENE_DISCLAIMER,
        "daily_trends": daily_trends,
        "monthly_trends": monthly_trends,
        "completion_by_class": completion_by_class,
        "participation_distribution": participation_distribution,
        "commonly_missed_steps": commonly_missed_steps,
    }


def generate_analytics_csv(
    conn: sqlite3.Connection,
    period: str | None = None,
    class_id: str | None = None,
    max_rows: int = 5000,
) -> str:
    """Generate a clean, sanitized CSV report with the mandatory hygiene disclaimer."""
    tz_name = SettingsRepository.get(conn, "school_timezone", "UTC") or "UTC"

    if not period or period == "current_month":
        period_key = compute_period_key(datetime.now(UTC), tz_name)
    else:
        period_key = period

    start_utc, end_utc = get_month_utc_bounds(period_key, tz_name)

    cursor = conn.cursor()
    class_filter_sql = " AND st.class_id = ?" if class_id else ""
    params: list[Any] = [start_utc, end_utc]
    if class_id:
        params.append(class_id)
    params.append(max_rows)

    cursor.execute(
        f"""
        SELECT
            s.session_id,
            s.started_at,
            st.school_student_code AS student_code,
            st.display_name AS student_name,
            c.name AS class_name,
            s.outcome,
            s.qualifies_for_points,
            COALESCE((
                SELECT SUM(rt.points_delta)
                FROM reward_transactions rt
                WHERE rt.session_id = s.session_id
            ), 0) AS points_awarded,
            s.duration_seconds,
            (
                SELECT COUNT(*)
                FROM session_steps ss
                WHERE ss.session_id = s.session_id AND ss.result = 'recognized'
            ) AS recognized_steps_count
        FROM sessions s
        LEFT JOIN students st ON s.student_id = st.student_id
        LEFT JOIN classes c ON st.class_id = c.class_id
        WHERE s.started_at >= ?
          AND s.started_at < ?
          {class_filter_sql}
        ORDER BY s.started_at DESC
        LIMIT ?;
        """,
        params,
    )
    rows = cursor.fetchall()

    output = io.StringIO()
    # Write mandatory disclaimer on line 1
    output.write(f"# {HYGIENE_DISCLAIMER}\n")

    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(
        [
            "Session ID",
            "Date",
            "Student Code",
            "Student Name",
            "Class",
            "Outcome",
            "Qualifies For Points",
            "Points Awarded",
            "Duration (s)",
            "Steps Recognized",
        ]
    )

    for r in rows:
        writer.writerow(
            [
                sanitize_csv_cell(r["session_id"]),
                sanitize_csv_cell(r["started_at"]),
                sanitize_csv_cell(r["student_code"] or "N/A"),
                sanitize_csv_cell(r["student_name"] or "Anonymous / Unassigned"),
                sanitize_csv_cell(r["class_name"] or "Unassigned"),
                sanitize_csv_cell(r["outcome"]),
                sanitize_csv_cell("Yes" if r["qualifies_for_points"] else "No"),
                sanitize_csv_cell(r["points_awarded"]),
                sanitize_csv_cell(
                    r["duration_seconds"] if r["duration_seconds"] is not None else 0
                ),
                sanitize_csv_cell(r["recognized_steps_count"]),
            ]
        )

    return output.getvalue()
