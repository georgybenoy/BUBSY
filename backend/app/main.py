"""Main FastAPI application entrypoint for Bubsy.

Adheres strictly to the architectural boundaries in AGENTS.md,
CODE_STYLE.md, and TECH_STACK.md.
"""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.database.connection import get_db_connection
from app.database.migrations.runner import run_migrations
from app.schemas.envelope import ErrorDetail, ResponseEnvelope
from app.services.kiosk_session_manager import kiosk_session_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and graceful shutdown."""
    configure_logging(settings.LOG_LEVEL)
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.APP_ENV)
    logger.info("Host bound to: %s:%d", settings.HOST, settings.PORT)
    logger.info("CORS origins allowed: %s", settings.CORS_ORIGINS)

    # Run database migrations on startup before serving requests
    logger.info("Executing database migrations at startup...")
    applied = run_migrations()
    if applied:
        logger.info("Applied %d migration(s) successfully: %s", len(applied), applied)
    else:
        logger.info("Database schema is up to date.")

    # Startup recovery: mark any sessions left incomplete after a crash as interrupted
    with get_db_connection() as conn:
        recovered = kiosk_session_manager.recover_interrupted_sessions(conn)
        if recovered:
            logger.info(
                "Startup crash recovery: handled %d interrupted session(s)", recovered
            )

    yield
    logger.info("Shutting down %s cleanly", settings.APP_NAME)
    kiosk_session_manager.vision_runner.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS restricted strictly to the local Vite dev/preview origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS
    if isinstance(settings.CORS_ORIGINS, list)
    else [settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


from fastapi import FastAPI, HTTPException


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTPException returning standardized ResponseEnvelope."""
    req_id = f"req_{uuid.uuid4().hex[:12]}"
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", f"HTTP_{exc.status_code}")
        message = exc.detail.get("message", str(exc.detail))
    else:
        code = f"HTTP_{exc.status_code}"
        message = str(exc.detail)

    envelope = ResponseEnvelope[None](
        data=None,
        error=ErrorDetail(code=code, message=message),
        request_id=req_id,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(),
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler returning standard response envelope without leaking traces."""
    req_id = f"req_{uuid.uuid4().hex[:12]}"
    logger.error(
        "Unhandled error on %s %s [request_id=%s]: %s",
        request.method,
        request.url.path,
        req_id,
        exc,
        exc_info=True,
    )

    envelope = ResponseEnvelope[None](
        data=None,
        error=ErrorDetail(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred while processing the request.",
        ),
        request_id=req_id,
    )
    return JSONResponse(status_code=500, content=envelope.model_dump())


# Mount API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root redirect / information endpoint."""
    return ResponseEnvelope[dict](
        data={
            "app": settings.APP_NAME,
            "docs": "/docs",
            "health": f"{settings.API_V1_PREFIX}/health",
        },
        error=None,
        request_id=f"req_{uuid.uuid4().hex[:12]}",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
