import sqlite3
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import get_current_active_teacher, get_db, require_role
from app.core.config import settings
from app.schemas.auth import (
    LoginRequest,
    LoginResponseData,
    LogoutResponseData,
    TeacherPublic,
    UpdateTeacherStatusRequest,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

require_admin = require_role("admin")


@router.post("/login", response_model=ResponseEnvelope[LoginResponseData])
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[LoginResponseData]:
    """Authenticate staff credentials and issue an active server session.

    Enforces sliding-window rate limiting, generic failure messages,
    and returns both a Bearer token and secure HttpOnly cookie.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    token, csrf_token, teacher = AuthService.authenticate_and_login(
        conn=conn,
        username=payload.username,
        password=payload.password,
        client_ip=client_ip,
    )

    # Set secure HttpOnly session cookie
    response.set_cookie(
        key="bubsy_session",
        value=token,
        max_age=settings.SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
    )

    # Set readable CSRF cookie for client-side CSRF token handling
    response.set_cookie(
        key="bubsy_csrf",
        value=csrf_token,
        max_age=settings.SESSION_TTL_SECONDS,
        httponly=False,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
    )

    teacher_public = TeacherPublic.model_validate(teacher)
    return ResponseEnvelope(
        data=LoginResponseData(
            token=token,
            csrf_token=csrf_token,
            teacher=teacher_public,
        )
    )


@router.post("/logout", response_model=ResponseEnvelope[LogoutResponseData])
def logout(
    response: Response,
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[LogoutResponseData]:
    """Terminate the current server-side session and clear cookies."""
    session_id = current_teacher.get("_session_id")
    AuthService.logout(
        conn=conn,
        session_token=session_id,
        current_teacher=current_teacher,
    )

    # Clear authentication cookies
    response.delete_cookie(key="bubsy_session", path="/")
    response.delete_cookie(key="bubsy_csrf", path="/")

    return ResponseEnvelope(data=LogoutResponseData(logged_out=True))


@router.get("/me", response_model=ResponseEnvelope[TeacherPublic])
def get_current_teacher_profile(
    current_teacher: Annotated[dict[str, Any], Depends(get_current_active_teacher)],
) -> ResponseEnvelope[TeacherPublic]:
    """Retrieve profile and role information for the currently authenticated staff member."""
    teacher_public = TeacherPublic.model_validate(current_teacher)
    return ResponseEnvelope(data=teacher_public)


@router.patch(
    "/teachers/{teacher_id}/status", response_model=ResponseEnvelope[TeacherPublic]
)
def update_teacher_status(
    teacher_id: str,
    payload: UpdateTeacherStatusRequest,
    admin_teacher: Annotated[dict[str, Any], Depends(require_admin)],
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> ResponseEnvelope[TeacherPublic]:
    """Admin-only endpoint to activate or deactivate a teacher account immediately."""
    updated = AuthService.set_teacher_active_status(
        conn=conn,
        target_teacher_id=teacher_id,
        is_active=payload.is_active,
        admin_teacher=admin_teacher,
    )
    return ResponseEnvelope(data=TeacherPublic.model_validate(updated))
