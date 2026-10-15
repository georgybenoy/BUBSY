"""Data-access repositories for Bubsy."""

from app.database.repositories.achievements_repo import AchievementsRepository
from app.database.repositories.audit_events_repo import AuditEventsRepository
from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.credentials_repo import CredentialsRepository
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.session_steps_repo import SessionStepsRepository
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.settings_repo import SettingsRepository
from app.database.repositories.student_achievements_repo import (
    StudentAchievementsRepository,
)
from app.database.repositories.students_repo import StudentsRepository
from app.database.repositories.teachers_repo import TeachersRepository

__all__ = [
    "AchievementsRepository",
    "AuditEventsRepository",
    "ClassesRepository",
    "CredentialsRepository",
    "RewardTransactionsRepository",
    "SessionStepsRepository",
    "SessionsRepository",
    "SettingsRepository",
    "StudentAchievementsRepository",
    "StudentsRepository",
    "TeachersRepository",
]
