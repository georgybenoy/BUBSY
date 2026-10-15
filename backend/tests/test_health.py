"""Integration tests for the backend health check and envelope format."""

import pytest
from app.core.config import Settings
from app.main import app
from fastapi.testclient import TestClient
from pydantic import ValidationError

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /api/v1/health returns 200 with standard envelope."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()

    # Assert top-level envelope fields according to CODE_STYLE.md Section 5
    assert "data" in body
    assert "error" in body
    assert "request_id" in body
    assert body["error"] is None
    assert body["request_id"].startswith("req_")

    # Assert data payload
    data = body["data"]
    assert data["status"] == "healthy"
    assert data["app_name"] == "Bubsy Handwashing Guidance System"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data
    assert "environment" in data


def test_root_endpoint():
    """Verify root / endpoint returns standard envelope."""
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["data"] is not None
    assert body["error"] is None
    assert "health" in body["data"]


def test_config_validation_fails_fast():
    """Verify that attempting to bind to a non-local host raises ValidationError."""
    with pytest.raises(ValidationError):
        Settings(HOST="0.0.0.0")


def test_config_validation_rejects_external_cors():
    """Verify that attempting to add an external CORS origin raises ValidationError."""
    with pytest.raises(ValidationError):
        Settings(CORS_ORIGINS=["https://malicious-external-site.com"])
