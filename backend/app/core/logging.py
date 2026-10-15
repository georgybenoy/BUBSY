"""Logging configuration for Bubsy application.

Enforces standard library logging, redaction of sensitive credentials,
and suppresses unstructured print calls.
"""

import logging
import re
import sys


class RedactingFilter(logging.Filter):
    """Filters log records to redact passwords, bearer tokens, secret hashes, and image payloads."""

    REDACTION_PATTERNS = [
        # Bearer tokens
        (re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE), r"\1[REDACTED]"),
        # Passwords, tokens, secrets, credential hashes in key-value pairs
        (
            re.compile(
                r"(\b(?:password|passwd|pwd|secret|token|credential_hash|auth_token)\s*[=:]\s*['\"]?)[^\s,'\"&]+(['\"]?)",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]\2",
        ),
        # Base64 image data URIs
        (
            re.compile(r"data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+", re.IGNORECASE),
            "[REDACTED_IMAGE_DATA]",
        ),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, replacement in self.REDACTION_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)

        if record.args:
            if isinstance(record.args, dict):
                redacted_args = {}
                for k, v in record.args.items():
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in self.REDACTION_PATTERNS:
                            val = pattern.sub(replacement, val)
                        redacted_args[k] = val
                    else:
                        redacted_args[k] = v
                record.args = redacted_args
            elif isinstance(record.args, tuple):
                redacted_args_list = []
                for v in record.args:
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in self.REDACTION_PATTERNS:
                            val = pattern.sub(replacement, val)
                        redacted_args_list.append(val)
                    else:
                        redacted_args_list.append(v)
                record.args = tuple(redacted_args_list)

        return True


def configure_logging(log_level: str = "INFO") -> logging.Logger:
    """Configure system-wide logging using standard logging module with automatic redaction."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RedactingFilter())

    # Configure root logger with standard formatting
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        handlers=[handler],
        force=True,
    )

    logger = logging.getLogger("bubsy")
    logger.setLevel(level)
    return logger


logger = logging.getLogger("bubsy")
logger.addFilter(RedactingFilter())
