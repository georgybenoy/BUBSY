"""Service managing school configuration, validation, and auditable updates."""

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from app.database.repositories.settings_repo import SettingsRepository
from app.services.leaderboard_service import resolve_school_timezone


def get_all_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """Retrieve all configuration settings parsed to typed representations."""
    raw = SettingsRepository.get_all(conn)

    def parse_bool(val: str | None, default: bool) -> bool:
        if val is None:
            return default
        return val.strip().lower() in ("1", "true", "yes", "on")

    return {
        "school_timezone": raw.get("school_timezone", "UTC"),
        "protocol_version": raw.get("protocol_version", "1.0.0"),
        "min_step_duration_seconds": int(raw.get("min_step_duration_seconds", 3)),
        "min_qualifying_score": float(raw.get("min_qualifying_score", 70.0)),
        "daily_reward_cap": int(raw.get("daily_reward_cap", 3)),
        "leaderboard_visibility": raw.get("leaderboard_visibility", "public"),
        "kiosk_language": raw.get("kiosk_language", "en"),
        "kiosk_audio_enabled": parse_bool(raw.get("kiosk_audio_enabled"), True),
        "first_name_display_allowed": parse_bool(
            raw.get("first_name_display_allowed"), True
        ),
        "allow_unassigned_sessions": parse_bool(
            raw.get("allow_unassigned_sessions"), True
        ),
        "data_retention_days": int(raw.get("data_retention_days", 365)),
    }


def update_settings_service(
    conn: sqlite3.Connection,
    updates: dict[str, Any],
    teacher_id: str,
) -> dict[str, Any]:
    """Validate and atomically apply configuration updates, logging audit events.

    Invariants:
    1. Restricted to admin role at API boundary.
    2. Audit event recorded in audit_events table.
    3. Timezone validated against IANA zoneinfo database.
    """
    cleaned_updates: dict[str, str] = {}

    for k, v in updates.items():
        if v is None:
            continue

        if k == "school_timezone":
            # Verify timezone is resolvable
            tz_obj = resolve_school_timezone(str(v))
            if str(v).strip().upper() not in ("UTC", "Z") and tz_obj == UTC:
                # If non-UTC string resolved to UTC fallback, it might be invalid
                try:
                    from zoneinfo import ZoneInfo

                    ZoneInfo(str(v).strip())
                except Exception as exc:
                    raise ValueError(f"Invalid timezone identifier: {v}") from exc
            cleaned_updates[k] = str(v).strip()

        elif k in (
            "kiosk_audio_enabled",
            "first_name_display_allowed",
            "allow_unassigned_sessions",
        ):
            cleaned_updates[k] = "true" if bool(v) else "false"

        elif k in (
            "min_step_duration_seconds",
            "daily_reward_cap",
            "data_retention_days",
        ):
            cleaned_updates[k] = str(int(v))

        elif k == "min_qualifying_score":
            cleaned_updates[k] = str(float(v))

        else:
            cleaned_updates[k] = str(v)

    # Persist each key
    for k, val_str in cleaned_updates.items():
        SettingsRepository.set(conn, k, val_str, updated_by_teacher_id=teacher_id)

    # Record audit event
    audit_id = str(uuid.uuid4())
    now_iso = datetime.now(UTC).isoformat()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO audit_events (
            audit_event_id, teacher_id, action, entity_type, entity_id, timestamp, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        (
            audit_id,
            teacher_id,
            "SETTINGS_UPDATE",
            "settings",
            "global",
            now_iso,
            json.dumps(cleaned_updates),
        ),
    )

    return get_all_settings(conn)
