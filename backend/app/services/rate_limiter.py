"""In-memory rate limiter for authentication endpoints.

Prevents credential brute-forcing while remaining lightweight and offline-first
for single-kiosk deployment.
"""

import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.core.config import settings


@dataclass
class RateLimitEntry:
    attempts: list[float] = field(default_factory=list)


class InMemoryRateLimiter:
    """Thread-safe sliding-window rate limiter for failed login attempts."""

    def __init__(
        self,
        max_attempts: int | None = None,
        window_seconds: int | None = None,
    ) -> None:
        self.max_attempts = (
            max_attempts
            if max_attempts is not None
            else settings.RATE_LIMIT_LOGIN_MAX_ATTEMPTS
        )
        self.window_seconds = (
            window_seconds
            if window_seconds is not None
            else settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS
        )
        self._entries: dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> tuple[bool, int]:
        """Check if the key is allowed to make another request.

        Returns:
            (allowed: bool, retry_after_seconds: int)
        """
        now = datetime.now(UTC).timestamp()
        cutoff = now - self.window_seconds

        with self._lock:
            entry = self._entries[key]
            # Prune attempts older than the window
            entry.attempts = [t for t in entry.attempts if t > cutoff]

            if len(entry.attempts) >= self.max_attempts:
                oldest_attempt = entry.attempts[0]
                retry_after = max(1, int(oldest_attempt + self.window_seconds - now))
                return False, retry_after

            return True, 0

    def record_failure(self, key: str) -> None:
        """Record a failed login attempt."""
        now = datetime.now(UTC).timestamp()
        cutoff = now - self.window_seconds

        with self._lock:
            entry = self._entries[key]
            entry.attempts = [t for t in entry.attempts if t > cutoff]
            entry.attempts.append(now)

    def reset(self, key: str) -> None:
        """Reset failed attempt counters upon successful login."""
        with self._lock:
            if key in self._entries:
                del self._entries[key]

    def clear(self) -> None:
        """Clear all entries (useful in testing)."""
        with self._lock:
            self._entries.clear()


# Global rate limiter instance
login_rate_limiter = InMemoryRateLimiter()
