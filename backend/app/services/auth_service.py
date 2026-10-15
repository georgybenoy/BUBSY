"""Authentication service implementing login business rules, rate limiting, and auditing.

Enforces generic error messages on login failures to prevent username enumeration,
Argon2id password verification, immediate session creation, and audit logging.
"""

import sqlite3
from typing import Any

from fastapi import HTTPException, status

from app.core.security import verify_password
from app.database.repositories.teachers_repo import TeachersRepository
from app.services.audit_service import AuditService
from app.services.rate_limiter import login_rate_limiter
from app.services.session_service import session_store

GENERIC_AUTH_ERROR = "Invalid username or password."


class AuthService:
    """Orchestrates authentication, session issuance, rate limiting, and auditing."""

    @staticmethod
    def authenticate_and_login(
        conn: sqlite3.Connection,
        username: str,
        password: str,
        client_ip: str | None = None,
    ) -> tuple[str, str, dict[str, Any]]:
        """Authenticate teacher credentials and issue an active server-side session.

        Returns:
            (session_token, csrf_token, teacher_dict)
        """
        rate_limit_key = client_ip or "local"
        allowed, retry_after = login_rate_limiter.is_allowed(rate_limit_key)
        if not allowed:
            AuditService.record_login_failed(
                conn,
                attempted_username=username,
                reason=f"rate_limited_retry_after_{retry_after}s",
                ip_address=client_ip,
            )
            conn.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "TOO_MANY_REQUESTS",
                    "message": f"Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
                },
                headers={"Retry-After": str(retry_after)},
            )

        teacher = TeachersRepository.get_by_username(conn, username)

        # 1. Non-existent user check
        if not teacher:
            login_rate_limiter.record_failure(rate_limit_key)
            AuditService.record_login_failed(
                conn,
                attempted_username=username,
                reason="user_not_found",
                ip_address=client_ip,
            )
            conn.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": GENERIC_AUTH_ERROR},
            )

        # 2. Verify password hash using Argon2id
        if not verify_password(password, teacher["password_hash"]):
            login_rate_limiter.record_failure(rate_limit_key)
            AuditService.record_login_failed(
                conn,
                attempted_username=username,
                reason="incorrect_password",
                ip_address=client_ip,
            )
            conn.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": GENERIC_AUTH_ERROR},
            )

        # 3. Check account active status (disabled accounts cannot log in)
        if teacher["is_active"] != 1:
            login_rate_limiter.record_failure(rate_limit_key)
            AuditService.record_login_failed(
                conn,
                attempted_username=username,
                reason="account_disabled",
                ip_address=client_ip,
            )
            conn.commit()
            # Generic error to prevent enumeration of disabled status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": GENERIC_AUTH_ERROR},
            )

        # Success: reset rate limit attempts for this client
        login_rate_limiter.reset(rate_limit_key)

        # Update last login timestamp in database
        TeachersRepository.update_last_login(conn, teacher["teacher_id"])

        # Audit successful login (guarantees no passwords or tokens are recorded)
        AuditService.record_login_success(
            conn,
            teacher_id=teacher["teacher_id"],
            username=teacher["username"],
            ip_address=client_ip,
        )

        # Issue server-side session and CSRF token
        session_token, csrf_token = session_store.create_session(
            teacher_id=teacher["teacher_id"],
            username=teacher["username"],
            role=teacher["role"],
        )

        # Fetch fresh teacher record with updated last_login_at
        fresh_teacher = TeachersRepository.get_by_id(conn, teacher["teacher_id"])
        return session_token, csrf_token, dict(fresh_teacher or teacher)

    @staticmethod
    def logout(
        conn: sqlite3.Connection,
        session_token: str | None,
        current_teacher: dict[str, Any],
    ) -> None:
        """Terminate the server-side session and record audit event."""
        if session_token:
            session_store.invalidate_session(session_token)

        AuditService.record_logout(
            conn,
            teacher_id=current_teacher["teacher_id"],
            username=current_teacher["username"],
        )

    @staticmethod
    def set_teacher_active_status(
        conn: sqlite3.Connection,
        target_teacher_id: str,
        is_active: int,
        admin_teacher: dict[str, Any],
    ) -> dict[str, Any]:
        """Update teacher active status and immediately revoke sessions if disabled."""
        target = TeachersRepository.get_by_id(conn, target_teacher_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Teacher account not found."},
            )

        # Prevent admin from deactivating self accidentally
        if target_teacher_id == admin_teacher["teacher_id"] and is_active == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SELF_DEACTIVATION_FORBIDDEN",
                    "message": "Administrators cannot deactivate their own account.",
                },
            )

        TeachersRepository.set_active_status(conn, target_teacher_id, is_active)

        # If deactivated, immediately revoke all existing sessions
        if is_active == 0:
            session_store.invalidate_teacher_sessions(target_teacher_id)

        AuditService.record_account_status_change(
            conn,
            teacher_id=target_teacher_id,
            changed_by_teacher_id=admin_teacher["teacher_id"],
            is_active=is_active,
        )

        updated = TeachersRepository.get_by_id(conn, target_teacher_id)
        return dict(updated or target)
