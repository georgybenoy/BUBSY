"""Seed synthetic demo fixtures for Bubsy development and local demonstration.

WARNING:
Per AGENTS.md rule 5: "Do not use mock data in production paths. Clearly label demo fixtures."
This script creates SYNTHETIC demo data clearly prefixed with [DEMO].
It will NEVER run automatically in production. It requires explicit --confirm execution.
"""

import argparse
import hashlib
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.database.connection import transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories import (
    AchievementsRepository,
    AuditEventsRepository,
    ClassesRepository,
    CredentialsRepository,
    SettingsRepository,
    StudentsRepository,
    TeachersRepository,
)


def seed_demo_data(confirm: bool = False, db_path: str | None = None) -> None:
    """Populate synthetic demo fixtures into the database."""
    configure_logging(settings.LOG_LEVEL)

    if not confirm:
        logger.error(
            "Aborted: Demo seed requires the explicit '--confirm' flag to prevent accidental execution."
        )
        sys.exit(1)

    if settings.APP_ENV == "production":
        logger.error(
            "CRITICAL: Refusing to seed demo fixtures in production environment! "
            "APP_ENV is currently set to 'production'."
        )
        sys.exit(1)

    logger.info("Ensuring database migrations are up to date before seeding...")
    run_migrations(db_path=db_path)

    logger.info("Beginning transaction to seed SYNTHETIC [DEMO] fixtures...")
    with transaction(db_path=db_path) as conn:
        # 1. System Settings
        SettingsRepository.set(conn, "school_timezone", "UTC")
        SettingsRepository.set(conn, "daily_reward_cap", "3")
        SettingsRepository.set(conn, "protocol_version", "1.0.0")
        SettingsRepository.set(conn, "retention_days", "365")
        logger.info("Seeded initial [DEMO] settings.")

        # 2. Demo Classes
        class_3a = ClassesRepository.create(
            conn,
            name="[DEMO] Class 3A",
            grade="Grade 3",
            academic_year="2026-2027",
            class_id="demo-class-3a",
        )
        class_4b = ClassesRepository.create(
            conn,
            name="[DEMO] Class 4B",
            grade="Grade 4",
            academic_year="2026-2027",
            class_id="demo-class-4b",
        )
        logger.info("Seeded 2 [DEMO] classes.")

        # 3. Demo Students
        demo_students_spec = [
            (
                "[DEMO] Leo Archer",
                "DEMO-S001",
                class_3a["class_id"],
                "demo-qr-token-001",
            ),
            (
                "[DEMO] Maya Chen",
                "DEMO-S002",
                class_3a["class_id"],
                "demo-qr-token-002",
            ),
            (
                "[DEMO] Noah Patel",
                "DEMO-S003",
                class_4b["class_id"],
                "demo-qr-token-003",
            ),
            (
                "[DEMO] Olivia Smith",
                "DEMO-S004",
                class_4b["class_id"],
                "demo-qr-token-004",
            ),
        ]

        for name, code, class_id, qr_secret in demo_students_spec:
            student = StudentsRepository.create(
                conn,
                display_name=name,
                class_id=class_id,
                school_student_code=code,
                student_id=f"demo-std-{code.lower()}",
            )

            # Generate HMAC-SHA256 hash for opaque token lookup
            from app.services.credential_service import CredentialService
            token_hash = CredentialService.compute_credential_hash(qr_secret)
            CredentialsRepository.create(
                conn,
                student_id=student["student_id"],
                credential_type="QR",
                credential_hash=token_hash,
                credential_id=f"demo-cred-{code.lower()}",
            )
        logger.info(
            "Seeded %d [DEMO] students and associated credentials.",
            len(demo_students_spec),
        )

        # 4. Demo Teacher Account (password: DemoPass123! - hashed with Argon2id)
        from app.core.security import hash_password

        demo_pass_hash = hash_password("DemoPass123!")
        teacher = TeachersRepository.create(
            conn,
            username="demo_teacher",
            password_hash=demo_pass_hash,
            role="admin",
            teacher_id="demo-teacher-001",
        )
        logger.info("Seeded [DEMO] teacher account: %s", teacher["username"])

        # 5. Demo Achievements
        AchievementsRepository.create(
            conn,
            name="[DEMO] Bubsy Champion",
            description="Awarded for outstanding handwashing technique and consistency.",
            criteria_json='{"qualifying_sessions_min": 20}',
            achievement_id="demo-ach-champion",
        )
        AchievementsRepository.create(
            conn,
            name="[DEMO] Master of 6 Steps",
            description="Recognized all 6 WHO rubbing movements in consecutive sequence.",
            criteria_json='{"min_score": 90, "all_steps_completed": true}',
            achievement_id="demo-ach-master",
        )
        logger.info("Seeded 2 [DEMO] achievements.")

        # 6. Audit Trail
        AuditEventsRepository.log(
            conn,
            action="SEED_DEMO_FIXTURES",
            entity_type="SYSTEM",
            entity_id="ALL",
            teacher_id=teacher["teacher_id"],
            details_json='{"seeded_classes": 2, "seeded_students": 4, "environment": "development"}',
        )
        logger.info("Logged audit event for demo seeding.")

    logger.info("Successfully completed seeding of synthetic [DEMO] fixtures.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed synthetic demo fixtures for Bubsy development."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Explicit confirmation required to seed demo fixtures.",
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=None,
        help="Optional custom SQLite database path to seed into.",
    )
    args = parser.parse_args()
    seed_demo_data(confirm=args.confirm, db_path=args.db_path)
