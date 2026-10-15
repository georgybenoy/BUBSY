"""Services package for Bubsy application."""

from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.class_service import ClassService
from app.services.credential_service import CredentialService
from app.services.leaderboard_service import (
    LeaderboardEntry,
    compute_leaderboard_ranks,
    compute_local_date_str,
    compute_period_key,
)
from app.services.reward_service import (
    QualificationResult,
    RewardNotFoundError,
    RewardServiceError,
    SessionNotFoundError,
    evaluate_qualification,
    process_session_reward,
    reverse_session_reward,
)
from app.services.scoring_service import (
    DeductionDetail,
    ScoringConfig,
    TechniqueScoreResult,
    compute_technique_score,
)
from app.services.session_engine import (
    IllegalStateTransitionError,
    ProtocolConfig,
    ProtocolStepConfig,
    SessionEngine,
    SessionEngineError,
    SessionInactiveError,
    SessionState,
    SessionStepEvent,
    get_default_protocol_config,
)
from app.services.student_service import StudentService

__all__ = [
    "AuditService",
    "AuthService",
    "ClassService",
    "CredentialService",
    "DeductionDetail",
    "IllegalStateTransitionError",
    "LeaderboardEntry",
    "ProtocolConfig",
    "ProtocolStepConfig",
    "QualificationResult",
    "RewardNotFoundError",
    "RewardServiceError",
    "ScoringConfig",
    "SessionEngine",
    "SessionEngineError",
    "SessionInactiveError",
    "SessionNotFoundError",
    "SessionState",
    "SessionStepEvent",
    "StudentService",
    "TechniqueScoreResult",
    "compute_leaderboard_ranks",
    "compute_local_date_str",
    "compute_period_key",
    "compute_technique_score",
    "evaluate_qualification",
    "get_default_protocol_config",
    "process_session_reward",
    "reverse_session_reward",
]
