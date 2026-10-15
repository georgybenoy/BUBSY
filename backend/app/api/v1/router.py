"""API v1 master router."""

from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.classes import router as classes_router
from app.api.v1.credentials import router as credentials_router
from app.api.v1.health import router as health_router
from app.api.v1.kiosk import router as kiosk_router
from app.api.v1.leaderboard import router as leaderboard_router
from app.api.v1.overview import router as overview_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.settings import router as settings_router
from app.api.v1.students import router as students_router
from app.api.v1.system import router as system_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(classes_router)
api_v1_router.include_router(students_router)
api_v1_router.include_router(credentials_router)
api_v1_router.include_router(kiosk_router)
api_v1_router.include_router(system_router)
api_v1_router.include_router(overview_router)
api_v1_router.include_router(sessions_router)
api_v1_router.include_router(leaderboard_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(settings_router)
