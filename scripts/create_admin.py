"""CLI script to create the first administrator account from environment input.

Security Rules:
- No hardcoded credentials anywhere.
- Never logs or stores plaintext passwords.
- Always uses Argon2id password hashing.
- Can read credentials from BUBSY_ADMIN_USERNAME and BUBSY_ADMIN_PASSWORD environment variables,
  or prompt interactively via masked terminal input.
"""

import argparse
import getpass
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so imports resolve
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.core.security import hash_password
from app.database.connection import transaction
from app.database.migrations.runner import run_migrations
from app.database.repositories.teachers_repo import TeachersRepository
from app.services.audit_service import AuditService


def create_admin_account(
    username: str | None = None,
    password: str | None = None,
    db_path: str | None = None,
) -> None:
    """Create an administrator account safely."""
    configure_logging(settings.LOG_LEVEL)

    # 1. Resolve username from args, env, or prompt
    admin_username = (username or os.getenv("BUBSY_ADMIN_USERNAME") or "").strip()

    if not admin_username:
        if sys.stdin.isatty():
            admin_username = input("Enter admin username: ").strip()
        else:
            logger.error(
                "Error: No username provided. Set BUBSY_ADMIN_USERNAME or use --username."
            )
            sys.exit(1)

    if len(admin_username) < 3:
        logger.error("Error: Admin username must be at least 3 characters long.")
        sys.exit(1)

    # 2. Resolve password from args, env, or masked prompt
    admin_password = password or os.getenv("BUBSY_ADMIN_PASSWORD") or ""

    if not admin_password:
        if sys.stdin.isatty():
            admin_password = getpass.getpass("Enter admin password: ")
            confirm_password = getpass.getpass("Confirm admin password: ")
            if admin_password != confirm_password:
                logger.error("Error: Passwords do not match.")
                sys.exit(1)
        else:
            logger.error(
                "Error: No password provided. Set BUBSY_ADMIN_PASSWORD or use --password."
            )
            sys.exit(1)

    if len(admin_password) < 8:
        logger.error("Error: Admin password must be at least 8 characters long.")
        sys.exit(1)

    # Ensure database migrations are current
    run_migrations(db_path=db_path)

    # Hash password with Argon2id
    password_hash = hash_password(admin_password)

    # Create admin record in atomic transaction
    with transaction(db_path=db_path) as conn:
        existing = TeachersRepository.get_by_username(conn, admin_username)
        if existing:
            logger.error(
                "Error: An account with username '%s' already exists.", admin_username
            )
            sys.exit(1)

        teacher = TeachersRepository.create(
            conn=conn,
            username=admin_username,
            password_hash=password_hash,
            role="admin",
            is_active=1,
        )

        AuditService.record_teacher_created(
            conn=conn,
            teacher_id=teacher["teacher_id"],
            username=admin_username,
            role="admin",
            created_by_teacher_id=None,
        )

    logger.info(
        "Successfully created administrator account for user '%s' (teacher_id: %s).",
        admin_username,
        teacher["teacher_id"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create the initial Bubsy administrator account safely."
    )
    parser.add_argument(
        "--username",
        type=str,
        default=None,
        help="Administrator username (or via BUBSY_ADMIN_USERNAME env var)",
    )
    parser.add_argument(
        "--password",
        type=str,
        default=None,
        help="Administrator password (or via BUBSY_ADMIN_PASSWORD env var)",
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=None,
        help="Optional target SQLite database path",
    )
    args = parser.parse_args()

    create_admin_account(
        username=args.username,
        password=args.password,
        db_path=args.db_path,
    )
