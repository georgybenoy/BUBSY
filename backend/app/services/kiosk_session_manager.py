"""Kiosk session coordinator managing active sessions, vision integration, and WebSockets.

Per PRD section 7.4 (FR-SES-01 to FR-SES-07), section 7.1 (FR-ID-10), and Phase 7 specifications:
- Coordinates session lifecycle between SessionEngine, VisionRunner, and database persistence.
- Connects VisionRunner events to WebSocket queues for child-friendly progress updates.
- Enforces mutual exclusion: IDENTIFY mode when idle, WASH mode during handwashing.
- Idempotent session completion with atomic scoring and reward issuance.
- Failed identification retry counter and recovery on crash/restart.
- Clean camera releases and shutdown.
"""

import asyncio
import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from typing import Any

from app.core.logging import logger
from app.database.connection import transaction
from app.database.repositories.reward_transactions_repo import (
    RewardTransactionsRepository,
)
from app.database.repositories.session_steps_repo import SessionStepsRepository
from app.database.repositories.sessions_repo import SessionsRepository
from app.database.repositories.settings_repo import SettingsRepository
from app.services.credential_reader import CredentialReader, NullCredentialReader
from app.services.reward_service import process_session_reward
from app.services.scoring_service import compute_technique_score
from app.services.session_engine import (
    ProtocolConfig,
    SessionEngine,
    SessionEngineError,
    SessionState,
    get_default_protocol_config,
)
from app.vision.runner import CameraMode, VisionRunner


class KioskSessionError(Exception):
    """Base exception for kiosk session management errors."""


class SessionAlreadyActiveError(KioskSessionError):
    """Raised when trying to start a session while another is active."""


class UnassignedSessionsDisabledError(KioskSessionError):
    """Raised when an unassigned session is requested but disallowed by school policy."""


class KioskSessionManager:
    """Singleton-style coordinator for kiosk hardware, vision runner, and active guidance session."""

    def __init__(
        self,
        vision_runner: VisionRunner | None = None,
        credential_reader: CredentialReader | None = None,
    ) -> None:
        self.vision_runner: VisionRunner = vision_runner or VisionRunner()
        self.credential_reader: CredentialReader = (
            credential_reader or NullCredentialReader()
        )

        self._active_engine: SessionEngine | None = None
        self._active_session_id: str | None = None
        self._failed_identification_retries: int = 0
        self._lock = threading.RLock()

        # WebSocket subscribers: session_id -> set of asyncio.Queue
        self._subscribers: dict[str, set[asyncio.Queue]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

        # Wire vision runner callbacks
        self.vision_runner.set_progress_callback(self._on_vision_progress)

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Register the running asyncio event loop for thread-safe WebSocket broadcasts."""
        self._loop = loop

    @property
    def active_session_id(self) -> str | None:
        """Return ID of currently active session, or None."""
        with self._lock:
            return self._active_session_id

    @property
    def active_engine(self) -> SessionEngine | None:
        """Return currently active SessionEngine instance, or None."""
        with self._lock:
            return self._active_engine

    @property
    def failed_retries(self) -> int:
        """Return current failed identification attempts counter."""
        with self._lock:
            return self._failed_identification_retries

    def record_failed_identification(
        self, conn: sqlite3.Connection
    ) -> tuple[int, bool]:
        """Increment failed identification counter and check against max retry setting."""
        with self._lock:
            self._failed_identification_retries += 1
            max_retries = int(
                SettingsRepository.get(conn, "max_identification_retries", "3")
            )
            is_exceeded = self._failed_identification_retries >= max_retries
            return self._failed_identification_retries, is_exceeded

    def reset_failed_identification(self) -> None:
        """Reset failed identification counter upon successful scan."""
        with self._lock:
            self._failed_identification_retries = 0

    def start_session(
        self,
        conn: sqlite3.Connection,
        student_id: str | None = None,
        is_unassigned: bool = False,
        kiosk_id: str = "kiosk-1",
        protocol: ProtocolConfig | None = None,
    ) -> dict[str, Any]:
        """Initialize and begin an active handwashing session on the kiosk.

        Transitions camera from IDENTIFY to WASH mode.
        """
        with self._lock:
            if (
                self._active_engine is not None
                and self._active_engine.state == SessionState.IN_PROGRESS
            ):
                raise SessionAlreadyActiveError(
                    f"A session ({self._active_session_id}) is already currently in progress."
                )

            # Check unassigned policy
            if student_id is None:
                if not is_unassigned:
                    raise KioskSessionError(
                        "Student ID is required unless is_unassigned is explicitly True."
                    )
                allow_unassigned = SettingsRepository.get(
                    conn, "allow_unassigned_sessions", "true"
                ).lower()
                if allow_unassigned not in ("true", "1", "yes"):
                    raise UnassignedSessionsDisabledError(
                        "Unassigned/anonymous sessions are disabled by school policy."
                    )

            proto = protocol or get_default_protocol_config()
            session_id = str(uuid.uuid4())
            now_iso = datetime.now(UTC).isoformat()

            # 1. Create session row in DB with initial 'incomplete' status
            SessionsRepository.create(
                conn,
                kiosk_id=kiosk_id,
                protocol_version=proto.protocol_version,
                student_id=student_id,
                outcome="incomplete",
                started_at=now_iso,
                session_id=session_id,
            )

            # 2. Instantiate SessionEngine
            engine = SessionEngine(
                session_id=session_id,
                student_id=student_id,
                kiosk_id=kiosk_id,
                protocol=proto,
                start_time_ms=0.0,
            )

            self._active_engine = engine
            self._active_session_id = session_id
            self._failed_identification_retries = 0

            # 3. Attach engine to VisionRunner and switch to WASH mode
            self.vision_runner.attach_session(engine)
            self.vision_runner.set_mode(CameraMode.WASH)

            logger.info(
                "Kiosk session started: %s (student=%s, unassigned=%s)",
                session_id,
                student_id or "NONE",
                is_unassigned,
            )

            first_step = engine.current_step
            return {
                "session_id": session_id,
                "student_id": student_id,
                "is_unassigned": engine.is_unassigned,
                "kiosk_id": kiosk_id,
                "started_at": now_iso,
                "state": engine.state.value,
                "protocol_version": proto.protocol_version,
                "current_step_code": first_step.step_code if first_step else None,
                "current_step_index": 0,
                "total_steps": len(proto.steps),
            }

    def complete_session(
        self,
        conn: sqlite3.Connection,
        session_id: str,
    ) -> dict[str, Any]:
        """Finalize an active session, compute deterministic technique score, and issue rewards.

        Idempotent: Repeated calls return the existing score and reward.
        Transitions camera from WASH back to IDENTIFY mode.
        """
        with self._lock:
            # 1. Check if already completed in DB (Idempotency)
            db_session = SessionsRepository.get_by_id(conn, session_id)
            if not db_session:
                raise KioskSessionError(f"Session '{session_id}' not found.")

            if db_session["outcome"] == "completed":
                reward_tx = RewardTransactionsRepository.get_by_idempotency_key(
                    conn, f"reward:session:{session_id}"
                )
                points_awarded = reward_tx["points_delta"] if reward_tx else 0
                return {
                    "session_id": session_id,
                    "outcome": "completed",
                    "technique_score": 100.0 if points_awarded > 0 else 0.0,
                    "points_awarded": points_awarded,
                    "qualifies_for_points": bool(db_session["qualifies_for_points"]),
                    "reason_code": reward_tx["reason_code"]
                    if reward_tx
                    else "ALREADY_COMPLETED",
                    "duration_seconds": db_session["duration_seconds"] or 0,
                    "status": "already_completed",
                    "breakdown": {},
                }

            engine = self._active_engine
            if engine and engine.session_id == session_id:
                events = engine.step_events
                ooo_count = engine.out_of_order_count
                session_state = "completed"
            else:
                events = []
                ooo_count = 0
                session_state = "completed"

            # 2. Compute technique score
            score_res = compute_technique_score(
                events=events,
                out_of_order_count=ooo_count,
                session_state=session_state,
            )

            # 3. Persist session step records to DB and issue rewards atomically
            with transaction(conn) as tx:
                for ev in events:
                    SessionStepsRepository.record_step(
                        tx,
                        session_id=session_id,
                        step_code=ev.step_code,
                        sequence_index=ev.sequence_index,
                        result=ev.result,
                        duration_ms=ev.duration_ms,
                        confidence_summary=ev.confidence_summary,
                    )

                # 4. Finalize session outcome in DB
                now_iso = datetime.now(UTC).isoformat()
                started_at_str = db_session["started_at"]
                started_dt = datetime.fromisoformat(started_at_str)
                duration_sec = max(
                    1, int((datetime.now(UTC) - started_dt).total_seconds())
                )

                SessionsRepository.finalize_session(
                    tx,
                    session_id=session_id,
                    ended_at=now_iso,
                    duration_seconds=duration_sec,
                    outcome="completed",
                    qualifies_for_points=0,
                )

                # 5. Issue reward points inside single atomic transaction
                reward_res = process_session_reward(
                    tx,
                    session_id=session_id,
                    technique_score=score_res.final_score,
                    is_uncertain=score_res.is_uncertain,
                )

            # 6. Detach engine and return camera to IDENTIFY mode
            if self._active_engine and self._active_engine.session_id == session_id:
                self.vision_runner.detach_session()
                self._active_engine = None
                self._active_session_id = None

            self.vision_runner.set_mode(CameraMode.IDENTIFY)

            logger.info(
                "Kiosk session completed: %s (score=%.1f, points=%d, qualifies=%s)",
                session_id,
                score_res.final_score,
                reward_res["points_awarded"],
                reward_res["qualifies"],
            )

            # Broadcast final completion event
            self._broadcast_event(
                session_id,
                {
                    "session_id": session_id,
                    "step_code": "COMPLETED",
                    "sequence_index": 9,
                    "step_number": 9,
                    "total_steps": 9,
                    "step_name": "Finished",
                    "prompt_text": "Great job! Handwashing session completed.",
                    "status_hint": "SESSION_COMPLETED",
                    "progress_ratio": 1.0,
                    "is_verified_step": False,
                    "is_completed": True,
                },
            )

            return {
                "session_id": session_id,
                "outcome": "completed",
                "technique_score": score_res.final_score,
                "points_awarded": reward_res["points_awarded"],
                "qualifies_for_points": reward_res["qualifies"],
                "reason_code": reward_res["reason_code"],
                "duration_seconds": duration_sec,
                "status": "completed",
                "breakdown": score_res.to_dict(),
            }

    def cancel_session(
        self,
        conn: sqlite3.Connection,
        session_id: str,
        reason: str = "CANCELLED_BY_USER",
    ) -> dict[str, Any]:
        """Cancel or abandon an active kiosk session without awarding points."""
        with self._lock:
            db_session = SessionsRepository.get_by_id(conn, session_id)
            if not db_session:
                raise KioskSessionError(f"Session '{session_id}' not found.")

            if self._active_engine and self._active_engine.session_id == session_id:
                try:
                    self._active_engine.abandon(reason=reason)
                except SessionEngineError as exc:
                    logger.debug(
                        "Session engine already transitioned or failed to abandon: %s",
                        exc,
                    )
                self.vision_runner.detach_session()
                self._active_engine = None
                self._active_session_id = None

            now_iso = datetime.now(UTC).isoformat()
            SessionsRepository.finalize_session(
                conn,
                session_id=session_id,
                ended_at=now_iso,
                duration_seconds=0,
                outcome="cancelled",
                qualifies_for_points=0,
                failure_reason=reason,
            )

            self.vision_runner.set_mode(CameraMode.IDENTIFY)
            logger.info("Kiosk session cancelled: %s (reason=%s)", session_id, reason)

            return {
                "session_id": session_id,
                "outcome": "cancelled",
                "failure_reason": reason,
            }

    def _on_vision_progress(self, event_data: dict[str, Any]) -> None:
        """Internal callback invoked from VisionRunner thread to broadcast progress."""
        session_id = event_data.get("session_id")
        if session_id:
            self._broadcast_event(session_id, event_data)

    def subscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """Register an asyncio queue to receive real-time child-safe events."""
        with self._lock:
            if session_id not in self._subscribers:
                self._subscribers[session_id] = set()
            self._subscribers[session_id].add(queue)

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """Unregister an asyncio queue."""
        with self._lock:
            if session_id in self._subscribers:
                self._subscribers[session_id].discard(queue)
                if not self._subscribers[session_id]:
                    del self._subscribers[session_id]

    def _broadcast_event(self, session_id: str, event_data: dict[str, Any]) -> None:
        """Thread-safely put event into all active WebSocket queues for the session."""
        with self._lock:
            queues = list(self._subscribers.get(session_id, []))

        if not queues:
            return

        for q in queues:
            try:
                if self._loop and self._loop.is_running():
                    self._loop.call_soon_threadsafe(q.put_nowait, event_data)
                else:
                    q.put_nowait(event_data)
            except (asyncio.QueueFull, RuntimeError) as exc:
                logger.debug("Could not push event to websocket queue: %s", exc)

    @staticmethod
    def recover_interrupted_sessions(conn: sqlite3.Connection) -> int:
        """Startup recovery: mark any session left in 'incomplete' status as interrupted.

        Ensures no points or rewards are issued for sessions abandoned during a crash.
        """
        now_iso = datetime.now(UTC).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE sessions
            SET outcome = 'incomplete',
                ended_at = COALESCE(ended_at, ?),
                qualifies_for_points = 0,
                failure_reason = 'SYSTEM_RESTART_RECOVERY'
            WHERE outcome = 'incomplete' AND qualifies_for_points = 0;
            """,
            (now_iso,),
        )
        recovered_count = cursor.rowcount
        if recovered_count > 0:
            conn.commit()
            logger.warning(
                "Startup recovery: marked %d crashed session(s) as interrupted without rewards.",
                recovered_count,
            )
        return recovered_count


# Global singleton instance for application use
kiosk_session_manager = KioskSessionManager()
