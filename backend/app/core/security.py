"""Cryptographic security utilities for Bubsy.

Provides Argon2id password hashing, constant-time verification,
and secure token/CSRF utilities. Never stores or logs plaintext passwords.
"""

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings

# Argon2id password hasher instance
_password_hasher = PasswordHasher()


def hash_password(plain_password: str) -> str:
    """Hash a password using Argon2id. Never stores plaintext."""
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against an Argon2id hash in constant time."""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def generate_session_token() -> str:
    """Generate a high-entropy cryptographically secure random session token."""
    return secrets.token_urlsafe(32)


def generate_csrf_token() -> str:
    """Generate a high-entropy random CSRF token."""
    return secrets.token_hex(16)


def sign_data(data: str) -> str:
    """Compute HMAC-SHA256 signature for data using backend SECRET_KEY."""
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_signature(data: str, signature: str) -> bool:
    """Constant-time comparison of expected vs provided HMAC signature."""
    expected = sign_data(data)
    return hmac.compare_digest(expected, signature)
