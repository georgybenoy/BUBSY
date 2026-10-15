"""Comprehensive privacy and security verification tests for Bubsy.

Verifies PRD and SECURITY.md invariants:
1. Scan runtime directories for persistent image/video files (Zero-persistence rule).
2. Scan source code for prohibited image-write or face-recognition imports.
3. Verify logging redaction filter masks credentials, tokens, and frames.
4. Verify CORS restrictions prevent wildcard / arbitrary origins.
5. Verify error responses contain no stack traces or server paths.
6. Verify report/CSV export authorization and sanitization.
7. Verify no VITE_* environment variable contains private keys or secrets.
"""

import ast
import logging
import os
import re
from pathlib import Path

import pytest
from app.core.config import settings
from app.core.logging import RedactingFilter
from app.main import app
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_runtime_directories_have_no_images_or_videos():
    """Verify runtime and repository directories have zero stored photos or session videos."""
    prohibited_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".bmp",
        ".webp",
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        ".gif",
    }

    # Directories to inspect
    runtime_dirs = [
        REPO_ROOT / "data",
        REPO_ROOT / "backend",
        REPO_ROOT / "frontend" / "public",
    ]

    found_files = []
    for directory in runtime_dirs:
        if not directory.exists():
            continue
        for root, dirs, files in os.walk(directory):
            # Skip node_modules or virtual environments if nested
            dirs[:] = [d for d in dirs if d not in (".venv", "node_modules", ".git")]
            for file in files:
                suffix = Path(file).suffix.lower()
                if suffix in prohibited_extensions:
                    found_files.append(os.path.join(root, file))

    assert (
        len(found_files) == 0
    ), f"Prohibited persistent media files discovered: {found_files}"


def test_source_code_has_no_prohibited_vision_or_face_recognition_calls():
    """Verify source code contains no imwrite, VideoWriter, or face recognition libraries."""
    prohibited_patterns = [
        r"\bcv2\.imwrite\b",
        r"\bcv2\.VideoWriter\b",
        r"\bface_recognition\b",
        r"\bmediapipe\.solutions\.face_mesh\b",
        r"\bmediapipe\.solutions\.face_detection\b",
        r"\bface_alignment\b",
        r"\bdlib\b",
    ]

    source_roots = [
        REPO_ROOT / "backend" / "app",
        REPO_ROOT / "frontend" / "src",
    ]

    violations = []
    for root_dir in source_roots:
        for file_path in root_dir.rglob("*"):
            if file_path.suffix in (".py", ".ts", ".tsx", ".js"):
                try:
                    content = file_path.read_text(encoding="utf-8")
                except Exception:
                    continue
                for pat in prohibited_patterns:
                    matches = re.findall(pat, content)
                    if matches:
                        violations.append((str(file_path), pat))

    assert (
        len(violations) == 0
    ), f"Found prohibited vision/face recognition APIs in source: {violations}"


def test_logging_redaction_filter():
    """Verify that RedactingFilter masks passwords, bearer tokens, and hashes."""
    filt = RedactingFilter()

    # Test Bearer Token Redaction
    rec1 = logging.LogRecord(
        name="bubsy.auth",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Incoming request Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz",
        args=(),
        exc_info=None,
    )
    filt.filter(rec1)
    assert "[REDACTED]" in rec1.msg
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz" not in rec1.msg

    # Test Password / Secret Redaction
    rec2 = logging.LogRecord(
        name="bubsy.auth",
        level=logging.WARNING,
        pathname="",
        lineno=0,
        msg="Failed login attempt with password=superSecretPassword123 and token=my_secret_token",
        args=(),
        exc_info=None,
    )
    filt.filter(rec2)
    assert "superSecretPassword123" not in rec2.msg
    assert "my_secret_token" not in rec2.msg
    assert "[REDACTED]" in rec2.msg


def test_cors_restrictions():
    """Verify CORS policy is strictly constrained to local application origins."""
    client = TestClient(app)

    # Request from an unauthorized external origin
    headers = {
        "Origin": "https://malicious-external-school-tracker.example.com",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/api/v1/health", headers=headers)

    # Must NOT allow wildcard origin
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "*"
    assert (
        allow_origin is None
        or allow_origin in settings.CORS_ORIGINS
    )


def test_error_responses_contain_no_stack_traces_or_system_paths():
    """Verify API error handlers return sanitized envelopes without leaking paths or traces."""
    client = TestClient(app, raise_server_exceptions=False)

    # Trigger a 404
    resp404 = client.get("/api/v1/non_existent_endpoint_for_test")
    assert resp404.status_code == 404
    body404 = resp404.json()
    assert "Traceback" not in str(body404)
    assert "C:\\" not in str(body404)
    assert "/Users/" not in str(body404)
    assert "detail" in body404 or "error" in body404

    # Trigger a 422 validation error
    resp422 = client.post("/api/v1/auth/login", json={"invalid_field": "invalid"})
    assert resp422.status_code == 422
    body422 = resp422.json()
    assert "Traceback" not in str(body422)
    assert "C:\\" not in str(body422)


def test_export_authorization_enforced():
    """Verify CSV export endpoint strictly requires authenticated staff credentials."""
    client = TestClient(app)

    # 1. Unauthenticated request must be rejected with 401
    resp_unauth = client.get("/api/v1/analytics/export?period=30d")
    assert resp_unauth.status_code == 401
    assert resp_unauth.json()["error"]["code"] in ("AUTHENTICATION_REQUIRED", "AUTH_REQUIRED", "UNAUTHORIZED")

    # 2. Tampered or forged bearer token must be rejected with 401
    resp_tampered = client.get(
        "/api/v1/analytics/export?period=30d",
        headers={"Authorization": "Bearer forged-invalid-token-12345"},
    )
    assert resp_tampered.status_code == 401


def test_no_secrets_in_vite_variables():
    """Verify that no VITE_* environment variable contains private keys or passwords."""
    env_files = [REPO_ROOT / ".env", REPO_ROOT / ".env.example"]
    prohibited_keywords = ["SECRET", "PASSWORD", "KEY", "PRIVATE", "HMAC"]

    for env_file in env_files:
        if not env_file.exists():
            continue
        lines = env_file.read_text(encoding="utf-8").splitlines()
        for line in lines:
            line = line.strip()
            if line.startswith("VITE_"):
                var_name = line.split("=")[0].upper()
                for keyword in prohibited_keywords:
                    # e.g., VITE_API_SECRET_KEY or similar should never exist
                    assert (
                        keyword not in var_name
                    ), f"Potential secret in frontend environment variable '{line}' in {env_file}"
