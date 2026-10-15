"""Audit service for logging authentication, student, credential, and administrative actions.

Writes structured records to the audit_events table.
Strictly guarantees no passwords, raw tokens, or biometric attributes are ever persisted or logged.
"""

import json
import sqlite3
from typing import Any

from app.core.logging import logger
from app.database.repositories.audit_events_repo import AuditEventsRepository


class AuditService:
    """Service for recording security-relevant actions to audit_events."""

    @staticmethod
    def record_login_success(
        conn: sqlite3.Connection,
        teacher_id: str,
        username: str,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Record successful staff login without logging credentials or tokens."""
        logger.info(
            "Successful login for user '%s' (teacher_id: %s) from IP %s",
            username,
            teacher_id,
            ip_address or "unknown",
        )
        details = json.dumps({"username": username, "ip": ip_address or "unknown"})
        return AuditEventsRepository.log(
            conn,
            action="LOGIN_SUCCESS",
            entity_type="AUTH",
            entity_id=teacher_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_login_failed(
        conn: sqlite3.Connection,
        attempted_username: str,
        reason: str,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Record failed staff login attempt. NEVER records the attempted password."""
        safe_username = attempted_username[:100]
        logger.warning(
            "Failed login attempt for username '%s' from IP %s. Reason: %s",
            safe_username,
            ip_address or "unknown",
            reason,
        )
        details = json.dumps(
            {
                "username": safe_username,
                "reason": reason,
                "ip": ip_address or "unknown",
            }
        )
        return AuditEventsRepository.log(
            conn,
            action="LOGIN_FAILED",
            entity_type="AUTH",
            entity_id=safe_username,
            teacher_id=None,
            details_json=details,
        )

    @staticmethod
    def record_logout(
        conn: sqlite3.Connection,
        teacher_id: str,
        username: str,
    ) -> dict[str, Any]:
        """Record user logout."""
        logger.info(
            "User '%s' (teacher_id: %s) logged out",
            username,
            teacher_id,
        )
        details = json.dumps({"username": username})
        return AuditEventsRepository.log(
            conn,
            action="LOGOUT",
            entity_type="AUTH",
            entity_id=teacher_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_account_status_change(
        conn: sqlite3.Connection,
        teacher_id: str,
        changed_by_teacher_id: str,
        is_active: int,
    ) -> dict[str, Any]:
        """Record modification of staff account active status."""
        action_name = "ACCOUNT_ACTIVATED" if is_active == 1 else "ACCOUNT_DEACTIVATED"
        logger.info(
            "Staff account %s status changed to %s by teacher %s",
            teacher_id,
            is_active,
            changed_by_teacher_id,
        )
        details = json.dumps(
            {
                "is_active": is_active,
                "status": "active" if is_active == 1 else "disabled",
            }
        )
        return AuditEventsRepository.log(
            conn,
            action=action_name,
            entity_type="TEACHER",
            entity_id=teacher_id,
            teacher_id=changed_by_teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_teacher_created(
        conn: sqlite3.Connection,
        teacher_id: str,
        username: str,
        role: str,
        created_by_teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Record creation of a staff account."""
        logger.info(
            "Staff account created: username='%s', role='%s', teacher_id=%s",
            username,
            role,
            teacher_id,
        )
        details = json.dumps({"username": username, "role": role})
        return AuditEventsRepository.log(
            conn,
            action="TEACHER_CREATED",
            entity_type="TEACHER",
            entity_id=teacher_id,
            teacher_id=created_by_teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_student_created(
        conn: sqlite3.Connection,
        student_id: str,
        display_name: str,
        class_id: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit student creation."""
        logger.info("Student created: %s (%s)", display_name, student_id)
        details = json.dumps({"display_name": display_name, "class_id": class_id})
        return AuditEventsRepository.log(
            conn,
            action="STUDENT_CREATED",
            entity_type="STUDENT",
            entity_id=student_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_student_updated(
        conn: sqlite3.Connection,
        student_id: str,
        changes: dict[str, Any],
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit student modification."""
        logger.info(
            "Student %s updated with changes: %s", student_id, list(changes.keys())
        )
        details = json.dumps(changes)
        return AuditEventsRepository.log(
            conn,
            action="STUDENT_UPDATED",
            entity_type="STUDENT",
            entity_id=student_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_student_status_changed(
        conn: sqlite3.Connection,
        student_id: str,
        is_active: int,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit soft deactivation or reactivation of student."""
        action_name = "STUDENT_ACTIVATED" if is_active == 1 else "STUDENT_DEACTIVATED"
        logger.info("Student %s active status set to %d", student_id, is_active)
        details = json.dumps({"is_active": is_active})
        return AuditEventsRepository.log(
            conn,
            action=action_name,
            entity_type="STUDENT",
            entity_id=student_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_credential_issued(
        conn: sqlite3.Connection,
        credential_id: str,
        student_id: str,
        credential_type: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit credential issuance (NEVER logs the raw credential token)."""
        logger.info(
            "Issued %s credential %s for student %s",
            credential_type,
            credential_id,
            student_id,
        )
        details = json.dumps(
            {"student_id": student_id, "credential_type": credential_type}
        )
        return AuditEventsRepository.log(
            conn,
            action="CREDENTIAL_ISSUED",
            entity_type="CREDENTIAL",
            entity_id=credential_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_credential_revoked(
        conn: sqlite3.Connection,
        credential_id: str,
        student_id: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit credential revocation."""
        logger.info("Revoked credential %s for student %s", credential_id, student_id)
        details = json.dumps({"student_id": student_id})
        return AuditEventsRepository.log(
            conn,
            action="CREDENTIAL_REVOKED",
            entity_type="CREDENTIAL",
            entity_id=credential_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_credential_replaced(
        conn: sqlite3.Connection,
        old_credential_id: str,
        new_credential_id: str,
        student_id: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit credential replacement."""
        logger.info(
            "Replaced credential %s with %s for student %s",
            old_credential_id,
            new_credential_id,
            student_id,
        )
        details = json.dumps(
            {
                "student_id": student_id,
                "old_credential_id": old_credential_id,
                "new_credential_id": new_credential_id,
            }
        )
        return AuditEventsRepository.log(
            conn,
            action="CREDENTIAL_REPLACED",
            entity_type="CREDENTIAL",
            entity_id=new_credential_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_students_imported(
        conn: sqlite3.Connection,
        imported_count: int,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit CSV batch import of students."""
        logger.info("Batch imported %d students", imported_count)
        details = json.dumps({"imported_count": imported_count})
        return AuditEventsRepository.log(
            conn,
            action="STUDENTS_IMPORTED",
            entity_type="SYSTEM",
            entity_id="CSV_IMPORT",
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_class_created(
        conn: sqlite3.Connection,
        class_id: str,
        name: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit class creation."""
        logger.info("Class created: %s (%s)", name, class_id)
        details = json.dumps({"name": name})
        return AuditEventsRepository.log(
            conn,
            action="CLASS_CREATED",
            entity_type="CLASS",
            entity_id=class_id,
            teacher_id=teacher_id,
            details_json=details,
        )

    @staticmethod
    def record_class_updated(
        conn: sqlite3.Connection,
        class_id: str,
        changes: dict[str, Any],
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Audit class update."""
        logger.info("Class %s updated: %s", class_id, list(changes.keys()))
        details = json.dumps(changes)
        return AuditEventsRepository.log(
            conn,
            action="CLASS_UPDATED",
            entity_type="CLASS",
            entity_id=class_id,
            teacher_id=teacher_id,
            details_json=details,
        )
