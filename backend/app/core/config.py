"""Bubsy Application Configuration.

Uses pydantic-settings to validate required environment settings at startup
and fails fast with actionable error messages if configuration is invalid.
"""

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "Bubsy Handwashing Guidance System"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    # Network Binding: strictly enforce 127.0.0.1 for local kiosk security
    HOST: str = Field(default="127.0.0.1", description="Local host binding")
    PORT: int = Field(default=8000, description="Local server port")

    # Security: Secret key for session/credential protection
    SECRET_KEY: str = Field(
        default="bubsy-dev-insecure-secret-key-min-32-chars-long",
        min_length=16,
        description="Cryptographic secret key for backend",
    )
    CREDENTIAL_HMAC_SECRET: str = Field(
        default="",
        description="Dedicated key for credential token hashing (defaults to SECRET_KEY if empty)",
    )
    SESSION_TTL_SECONDS: int = Field(
        default=28800,
        description="Session validity lifetime in seconds (default 8 hours)",
    )
    COOKIE_SECURE: bool = Field(
        default=False,
        description="Whether auth cookies require HTTPS (True in production)",
    )
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = Field(
        default=5,
        description="Maximum failed login attempts allowed within rate limit window",
    )
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = Field(
        default=300,
        description="Rate limit window in seconds (default 5 minutes)",
    )

    # CORS: Restricted strictly to local Vite origin only
    CORS_ORIGINS: list[str] | str = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Allowed CORS origins",
    )

    # Database: Local SQLite
    DATABASE_URL: str = Field(
        default="sqlite:///./bubsy.db",
        description="Local SQLite connection string",
    )

    # Vision Model settings
    MODEL_PATH: str = Field(
        default="models/bubsy_yolo_v1.pt",
        description="Relative or absolute path to approved model weights",
    )
    MODEL_VERSION: str = Field(
        default="1.0.0",
        description="Approved model version tag",
    )

    @field_validator("HOST")
    @classmethod
    def validate_host_local_only(cls, value: str) -> str:
        """Enforce binding to 127.0.0.1 only."""
        if value not in ("127.0.0.1", "localhost"):
            raise ValueError(
                f"Security violation: HOST is set to '{value}'. "
                "Bubsy must bind strictly to 127.0.0.1 to avoid exposing local kiosk services to the school network."
            )
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: list[str] | str) -> list[str]:
        """Parse comma-separated strings or validate string lists."""
        if isinstance(value, str):
            value = [
                orig.strip()
                for orig in value.strip("[]")
                .replace('"', "")
                .replace("'", "")
                .split(",")
                if orig.strip()
            ]
        return value

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, origins: list[str]) -> list[str]:
        """Ensure CORS is restricted strictly to local Vite origins."""
        for origin in origins:
            if not (origin.startswith(("http://localhost:", "http://127.0.0.1:"))):
                raise ValueError(
                    f"Security violation: CORS origin '{origin}' is forbidden. "
                    "Bubsy only permits local Vite dev/preview origins (http://localhost:* or http://127.0.0.1:*)."
                )
        return origins


def load_settings() -> Settings:
    """Load and validate settings with fail-fast exception handling."""
    try:
        return Settings()
    except Exception as exc:
        error_msg = (
            "\n"
            "=" * 70 + "\n"
            "FATAL CONFIGURATION ERROR AT STARTUP\n"
            f"Bubsy cannot start due to invalid or missing configuration:\n{exc}\n"
            "Please check your .env file or environment variables.\n"
            "=" * 70
        )
        raise RuntimeError(error_msg) from exc


settings = load_settings()
