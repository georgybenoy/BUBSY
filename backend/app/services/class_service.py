"""Class service handling creation, updates, and aggregate summaries."""

import sqlite3
from typing import Any

from fastapi import HTTPException, status

from app.database.repositories.classes_repo import ClassesRepository
from app.services.audit_service import AuditService


class ClassService:
    """Service methods for class roster management."""

    @staticmethod
    def create_class(
        conn: sqlite3.Connection,
        name: str,
        academic_year: str,
        grade: str | None = None,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new school class with duplicate checks and audit trail."""
        cleaned_name = name.strip()
        cleaned_year = academic_year.strip()

        existing = ClassesRepository.get_by_name_and_year(
            conn, cleaned_name, cleaned_year
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CLASS_ALREADY_EXISTS",
                    "message": f"Class '{cleaned_name}' for academic year '{cleaned_year}' already exists.",
                },
            )

        class_record = ClassesRepository.create(
            conn=conn,
            name=cleaned_name,
            academic_year=cleaned_year,
            grade=grade.strip() if grade else None,
            is_active=1,
        )

        AuditService.record_class_created(
            conn=conn,
            class_id=class_record["class_id"],
            name=cleaned_name,
            teacher_id=teacher_id,
        )

        return class_record

    @staticmethod
    def get_class_by_id(conn: sqlite3.Connection, class_id: str) -> dict[str, Any]:
        """Fetch class by ID or raise 404."""
        record = ClassesRepository.get_by_id(conn, class_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CLASS_NOT_FOUND", "message": "Class not found."},
            )
        return record

    @staticmethod
    def update_class(
        conn: sqlite3.Connection,
        class_id: str,
        name: str | None = None,
        grade: str | None = None,
        academic_year: str | None = None,
        is_active: int | None = None,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Update class details with change auditing."""
        existing = ClassService.get_class_by_id(conn, class_id)

        changes: dict[str, Any] = {}
        if name is not None and name.strip() != existing["name"]:
            changes["name"] = name.strip()
        if grade is not None and grade != existing["grade"]:
            changes["grade"] = grade.strip() if grade else None
        if (
            academic_year is not None
            and academic_year.strip() != existing["academic_year"]
        ):
            changes["academic_year"] = academic_year.strip()
        if is_active is not None and is_active != existing["is_active"]:
            changes["is_active"] = is_active

        updated = ClassesRepository.update(
            conn=conn,
            class_id=class_id,
            name=changes.get("name"),
            grade=changes.get("grade"),
            academic_year=changes.get("academic_year"),
            is_active=changes.get("is_active"),
        )

        if changes:
            AuditService.record_class_updated(
                conn=conn,
                class_id=class_id,
                changes=changes,
                teacher_id=teacher_id,
            )

        return dict(updated or existing)

    @staticmethod
    def list_classes_summary(
        conn: sqlite3.Connection, active_only: bool = False
    ) -> list[dict[str, Any]]:
        """List classes with aggregated metrics per DESIGN.md section 3.4."""
        return ClassesRepository.list_classes_with_summary(
            conn, active_only=active_only
        )

    @staticmethod
    def list_all(
        conn: sqlite3.Connection, active_only: bool = True
    ) -> list[dict[str, Any]]:
        """List classes for dropdowns and selectors."""
        return ClassesRepository.list_all(conn, active_only=active_only)
