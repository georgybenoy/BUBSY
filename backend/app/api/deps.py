"""FastAPI dependencies for authentication, RBAC, and database connections.

Enforces server-side authorization checks, role-based access control (RBAC),
and immediate invalidation for deactivated teacher accounts.
"""

import hmac
import sqlite3
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status

from app.database.connection import get_db_connection
from app.database.repositories.teachers_repo import TeachersRepository
from app.services.session_service import session_store


def get_db():
    """Dependency yielding an active SQLite database connection with auto-commit."""
    with get_db_connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def get_current_active_teacher(
    request: Request,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> dict[str, Any]:
    """Retrieve and validate the currently authenticated teacher.

    Extracts session from Authorization header (Bearer token) or HttpOnly cookie.
    Validates CSRF token if cookie-based auth is used for mutating methods.
    Verifies that the teacher account still exists and is currently active (is_active == 1).
    """
    token: str | None = None
    auth_header = request.headers.get("Authorization")
    is_cookie_auth = False

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif "bubsy_session" in request.cookies:
        token = request.cookies.get("bubsy_session")
        is_cookie_auth = True

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication required."},
        )

    # CSRF protection when auth is delivered via browser cookies on state-changing methods
    if is_cookie_auth and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("bubsy_csrf")
        if (
            not csrf_header
            or not csrf_cookie
            or not hmac.compare_digest(csrf_header, csrf_cookie)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "CSRF_VALIDATION_FAILED",
                    "message": "Invalid or missing CSRF token.",
                },
            )

    # Validate active session in server-side session registry
    session_data = session_store.get_session(token)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "SESSION_EXPIRED",
                "message": "Session has expired or is invalid.",
            },
        )

    # Verify directly against database that account is active
    teacher = TeachersRepository.get_by_id(conn, session_data.teacher_id)
    if not teacher or teacher.get("is_active") != 1:
        # Account is disabled or removed - invalidate session immediately
        session_store.invalidate_teacher_sessions(session_data.teacher_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ACCOUNT_DISABLED",
                "message": "This account is disabled.",
            },
        )

    # Attach token for downstream logout or inspection if needed
    teacher_dict = dict(teacher)
    teacher_dict["_session_id"] = token
    return teacher_dict


def require_role(*allowed_roles: str) -> Callable:
    """Reusable FastAPI dependency factory enforcing Role-Based Access Control (RBAC).

    Usage:
        @router.get("/admin-path", dependencies=[Depends(require_role("admin"))])
        def admin_view(): ...
        or
        @router.get("/teacher-path")
        def teacher_view(teacher = Depends(require_role("teacher", "admin"))): ...
    """

    def role_checker(
        teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    ) -> dict[str, Any]:
        if allowed_roles and teacher.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "Insufficient permissions for this action.",
                },
            )
        return teacher

    return role_checker
