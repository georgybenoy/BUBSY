"""Leaderboard rankings, period keys, and tie-breaking calculations.

Implements rules per PRD section 7.7 (FR-LEAD-01 to FR-LEAD-04):
- FR-LEAD-02: Local school timezone (zoneinfo) determining month start/end and period_key.
- FR-LEAD-04: Tie-breaking using higher average qualifying technique score,
  followed by qualifying-day count, with unresolved ties sharing the same rank.

PURE Python / zoneinfo: zero OpenCV, YOLO, or FastAPI imports.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def resolve_school_timezone(tz_name: str | None) -> Any:
    """Resolve a timezone string into a tzinfo instance, safely falling back to UTC."""
    if not tz_name or tz_name.strip().upper() in ("UTC", "Z", "+00:00", "+0000"):
        return UTC
    try:
        return ZoneInfo(tz_name.strip())
    except (ZoneInfoNotFoundError, ModuleNotFoundError, ValueError, KeyError):
        return UTC


def parse_datetime_to_utc(dt_val: datetime | str) -> datetime:
    """Ensure a datetime object is timezone-aware in UTC."""
    if isinstance(dt_val, str):
        # Handle ISO-8601 strings
        cleaned = dt_val.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
    else:
        parsed = dt_val

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def compute_period_key(
    dt_val: datetime | str,
    timezone_name: str = "UTC",
) -> str:
    """Calculate the YYYY-MM period key in the school's configured local timezone.

    Respects month boundaries across daylight savings and UTC offsets.
    """
    utc_dt = parse_datetime_to_utc(dt_val)
    local_tz = resolve_school_timezone(timezone_name)
    local_dt = utc_dt.astimezone(local_tz)
    return local_dt.strftime("%Y-%m")


def compute_local_date_str(
    dt_val: datetime | str,
    timezone_name: str = "UTC",
) -> str:
    """Calculate the YYYY-MM-DD local date in the school's configured timezone."""
    utc_dt = parse_datetime_to_utc(dt_val)
    local_tz = resolve_school_timezone(timezone_name)
    local_dt = utc_dt.astimezone(local_tz)
    return local_dt.strftime("%Y-%m-%d")


def get_month_utc_bounds(
    month_str: str | None,
    timezone_name: str = "UTC",
) -> tuple[str, str]:
    """Calculate the UTC start (inclusive) and end (exclusive) ISO timestamps for a given period or YYYY-MM in school local time."""
    from datetime import timedelta

    local_tz = resolve_school_timezone(timezone_name)
    now_local = datetime.now(UTC).astimezone(local_tz)

    if not month_str or month_str in ("current_month", "this_month"):
        start_local = datetime(now_local.year, now_local.month, 1, 0, 0, 0, tzinfo=local_tz)
        if now_local.month == 12:
            end_local = datetime(now_local.year + 1, 1, 1, 0, 0, 0, tzinfo=local_tz)
        else:
            end_local = datetime(now_local.year, now_local.month + 1, 1, 0, 0, 0, tzinfo=local_tz)
        return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()

    if month_str == "today":
        start_local = datetime(now_local.year, now_local.month, now_local.day, 0, 0, 0, tzinfo=local_tz)
        end_local = start_local + timedelta(days=1)
        return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()

    if month_str.endswith("d") and month_str[:-1].isdigit():
        days = int(month_str[:-1])
        base_day = now_local - timedelta(days=days)
        start_local = datetime(base_day.year, base_day.month, base_day.day, 0, 0, 0, tzinfo=local_tz)
        tomorrow = now_local + timedelta(days=1)
        end_local = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=local_tz)
        return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()

    if "-" in month_str:
        try:
            parts = month_str.split("-")
            year = int(parts[0])
            month = int(parts[1])
            start_local = datetime(year, month, 1, 0, 0, 0, tzinfo=local_tz)
            if month == 12:
                end_local = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=local_tz)
            else:
                end_local = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=local_tz)
            return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()
        except (ValueError, IndexError):
            pass

    # Default fallback: past 30 days
    base_day = now_local - timedelta(days=30)
    start_local = datetime(base_day.year, base_day.month, base_day.day, 0, 0, 0, tzinfo=local_tz)
    tomorrow = now_local + timedelta(days=1)
    end_local = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=local_tz)
    return start_local.astimezone(UTC).isoformat(), end_local.astimezone(UTC).isoformat()


@dataclass(frozen=True)
class LeaderboardEntry:
    """Individual student monthly standing."""

    student_id: str
    display_name: str
    total_points: int
    avg_technique_score: float
    qualifying_days_count: int
    rank: int = 1


def compute_leaderboard_ranks(
    entries: Sequence[LeaderboardEntry],
) -> list[LeaderboardEntry]:
    """Compute leaderboard rankings applying FR-LEAD-04 tie-breaking rules.

    Tie-breaking hierarchy:
    1. Total points (descending)
    2. Average qualifying technique score (descending)
    3. Distinct qualifying-day count (descending)
    4. Unresolved ties share the exact same rank.
    """
    if not entries:
        return []

    # Sort entries by priority rules
    # For stable deterministic evaluation in Python:
    sorted_entries = sorted(
        entries,
        key=lambda e: (
            -e.total_points,
            -round(e.avg_technique_score, 2),
            -e.qualifying_days_count,
            e.student_id,  # Deterministic secondary key
        ),
    )

    ranked: list[LeaderboardEntry] = []
    current_rank = 1

    for i, entry in enumerate(sorted_entries):
        if i == 0:
            current_rank = 1
        else:
            prev = sorted_entries[i - 1]
            # Check if all three metrics are strictly tied
            is_unresolved_tie = (
                entry.total_points == prev.total_points
                and round(entry.avg_technique_score, 2)
                == round(prev.avg_technique_score, 2)
                and entry.qualifying_days_count == prev.qualifying_days_count
            )
            if is_unresolved_tie:
                # Share the exact same rank as previous tied competitor
                current_rank = ranked[i - 1].rank
            else:
                # Standard competition ranking: position + 1
                current_rank = i + 1

        ranked.append(replace(entry, rank=current_rank))

    return ranked
