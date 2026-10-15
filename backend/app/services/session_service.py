"""Server-side session management for authenticated teachers.

Provides thread-safe session tracking, expiration enforcement,
CSRF token association, and immediate revocation when accounts are disabled.
"""

import threading
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.config import settings
from app.core.security import generate_csrf_token, generate_session_token


@dataclass
class SessionData:
    session_id: str
    teacher_id: str
    username: str
    role: str
    created_at: float
    expires_at: float
    csrf_token: str


class SessionStore:
    """Thread-safe in-memory session registry with TTL and revocation."""

    def __init__(self, session_ttl_seconds: int | None = None) -> None:
        self.session_ttl_seconds = (
            session_ttl_seconds
            if session_ttl_seconds is not None
            else settings.SESSION_TTL_SECONDS
        )
        self._sessions: dict[str, SessionData] = {}
        self._lock = threading.Lock()

    def create_session(
        self, teacher_id: str, username: str, role: str
    ) -> tuple[str, str]:
        """Create a new session, returning (session_token, csrf_token)."""
        session_id = generate_session_token()
        csrf_token = generate_csrf_token()
        now = datetime.now(UTC).timestamp()
        expires_at = now + self.session_ttl_seconds

        session = SessionData(
            session_id=session_id,
            teacher_id=teacher_id,
            username=username,
            role=role,
            created_at=now,
            expires_at=expires_at,
            csrf_token=csrf_token,
        )

        with self._lock:
            self._sessions[session_id] = session

        return session_id, csrf_token

    def get_session(self, session_id: str) -> SessionData | None:
        """Retrieve active session if not expired."""
        now = datetime.now(UTC).timestamp()

        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None

            if now > session.expires_at:
                del self._sessions[session_id]
                return None

            return session

    def invalidate_session(self, session_id: str) -> bool:
        """Revoke a single session token immediately upon logout."""
        with self._lock:
            return self._sessions.pop(session_id, None) is not None

    def invalidate_teacher_sessions(self, teacher_id: str) -> int:
        """Revoke all sessions for a specific teacher (e.g. when disabled)."""
        revoked_count = 0
        with self._lock:
            to_remove = [
                sid
                for sid, sdata in self._sessions.items()
                if sdata.teacher_id == teacher_id
            ]
            for sid in to_remove:
                del self._sessions[sid]
                revoked_count += 1
        return revoked_count

    def clear(self) -> None:
        """Clear all active sessions (testing helper)."""
        with self._lock:
            self._sessions.clear()


# Global session store instance
session_store = SessionStore()
