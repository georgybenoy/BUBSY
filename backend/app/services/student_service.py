"""Student service implementing CRUD, soft deactivation, pagination,
filtering, CSV batch import with injection protection, and credential issuance.
"""

import csv
import io
import re
import sqlite3
from typing import Any

from fastapi import HTTPException, status

from app.database.repositories.classes_repo import ClassesRepository
from app.database.repositories.credentials_repo import CredentialsRepository
from app.database.repositories.students_repo import StudentsRepository
from app.services.audit_service import AuditService
from app.services.credential_service import CredentialService

MAX_CSV_BYTES = 1024 * 1024  # 1 MB
MAX_CSV_ROWS = 500


def sanitize_csv_cell(value: str) -> str:
    """Sanitize cell value against CSV formula injection."""
    cleaned = value.strip()
    if cleaned and cleaned[0] in ("=", "+", "-", "@", "\t", "\r"):
        # Prepend single quote or strip formula trigger
        return re.sub(r"^([=+\-@\t\r]+)", "", cleaned)
    return cleaned


class StudentService:
    """Service methods for student management and bulk onboarding."""

    @staticmethod
    def create_student(
        conn: sqlite3.Connection,
        display_name: str,
        class_id: str,
        school_student_code: str | None = None,
        auto_issue_qr: bool = True,
        teacher_id: str | None = None,
    ) -> tuple[dict[str, Any], str | None]:
        """Create a student record and optionally issue an initial QR credential.

        Returns (student_record, raw_qr_token_or_none).
        """
        cleaned_name = sanitize_csv_cell(display_name)
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "display_name cannot be blank.",
                },
            )

        # Verify class exists
        class_record = ClassesRepository.get_by_id(conn, class_id)
        if not class_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "CLASS_NOT_FOUND",
                    "message": "Assigned class does not exist.",
                },
            )

        cleaned_code: str | None = None
        if school_student_code and school_student_code.strip():
            cleaned_code = sanitize_csv_cell(school_student_code)
            existing = StudentsRepository.get_by_school_code(conn, cleaned_code)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "DUPLICATE_STUDENT_CODE",
                        "message": f"Student with code '{cleaned_code}' already exists.",
                    },
                )

        student = StudentsRepository.create(
            conn=conn,
            display_name=cleaned_name,
            class_id=class_id,
            school_student_code=cleaned_code,
            is_active=1,
        )

        AuditService.record_student_created(
            conn=conn,
            student_id=student["student_id"],
            display_name=cleaned_name,
            class_id=class_id,
            teacher_id=teacher_id,
        )

        raw_qr_token: str | None = None
        if auto_issue_qr:
            _, raw_qr_token = CredentialService.issue_credential(
                conn=conn,
                student_id=student["student_id"],
                credential_type="QR",
                teacher_id=teacher_id,
            )

        # Fetch enriched record with class_name
        full_student = StudentsRepository.get_by_id(conn, student["student_id"])
        return dict(full_student or student), raw_qr_token

    @staticmethod
    def get_student_detail(conn: sqlite3.Connection, student_id: str) -> dict[str, Any]:
        """Fetch student detail along with registered credentials."""
        student = StudentsRepository.get_by_id(conn, student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "STUDENT_NOT_FOUND",
                    "message": "Student record not found.",
                },
            )

        credentials = CredentialsRepository.list_by_student(conn, student_id)
        active_qr = next(
            (
                c
                for c in credentials
                if c["credential_type"] == "QR" and c["is_active"] == 1
            ),
            None,
        )
        active_nfc = next(
            (
                c
                for c in credentials
                if c["credential_type"] == "NFC" and c["is_active"] == 1
            ),
            None,
        )

        record = dict(student)
        record["credentials"] = credentials
        record["active_qr_credential_id"] = (
            active_qr["credential_id"] if active_qr else None
        )
        record["active_nfc_credential_id"] = (
            active_nfc["credential_id"] if active_nfc else None
        )
        return record

    @staticmethod
    def update_student(
        conn: sqlite3.Connection,
        student_id: str,
        display_name: str | None = None,
        class_id: str | None = None,
        school_student_code: str | None = None,
        is_active: int | None = None,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Update student attributes with validation and audit trail."""
        existing = StudentsRepository.get_by_id(conn, student_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "STUDENT_NOT_FOUND",
                    "message": "Student record not found.",
                },
            )

        changes: dict[str, Any] = {}
        if display_name is not None:
            cleaned_name = sanitize_csv_cell(display_name)
            if cleaned_name != existing["display_name"]:
                changes["display_name"] = cleaned_name

        if class_id is not None and class_id != existing["class_id"]:
            target_class = ClassesRepository.get_by_id(conn, class_id)
            if not target_class:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "CLASS_NOT_FOUND",
                        "message": "Target class does not exist.",
                    },
                )
            changes["class_id"] = class_id

        if school_student_code is not None:
            cleaned_code = (
                sanitize_csv_cell(school_student_code)
                if school_student_code.strip()
                else None
            )
            if cleaned_code != existing["school_student_code"]:
                if cleaned_code is not None:
                    code_match = StudentsRepository.get_by_school_code(
                        conn, cleaned_code
                    )
                    if code_match and code_match["student_id"] != student_id:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail={
                                "code": "DUPLICATE_STUDENT_CODE",
                                "message": f"Student code '{cleaned_code}' is already assigned to another student.",
                            },
                        )
                changes["school_student_code"] = cleaned_code

        if is_active is not None and is_active != existing["is_active"]:
            changes["is_active"] = is_active

        updated = StudentsRepository.update(
            conn=conn,
            student_id=student_id,
            display_name=changes.get("display_name"),
            class_id=changes.get("class_id"),
            school_student_code=changes.get("school_student_code"),
            is_active=changes.get("is_active"),
        )

        if changes:
            AuditService.record_student_updated(
                conn=conn,
                student_id=student_id,
                changes=changes,
                teacher_id=teacher_id,
            )

        return dict(updated or existing)

    @staticmethod
    def set_student_active_status(
        conn: sqlite3.Connection,
        student_id: str,
        is_active: int,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Soft-deactivate (0) or reactivate (1) a student account."""
        existing = StudentsRepository.get_by_id(conn, student_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "STUDENT_NOT_FOUND",
                    "message": "Student record not found.",
                },
            )

        StudentsRepository.set_active_status(conn, student_id, is_active)
        AuditService.record_student_status_changed(
            conn=conn,
            student_id=student_id,
            is_active=is_active,
            teacher_id=teacher_id,
        )

        updated = StudentsRepository.get_by_id(conn, student_id)
        return dict(updated or existing)

    @staticmethod
    def list_students_paginated(
        conn: sqlite3.Connection,
        page: int = 1,
        page_size: int = 20,
        class_id: str | None = None,
        is_active: int | None = None,
        search: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Fetch students list with pagination, search, and metrics."""
        return StudentsRepository.list_paginated_with_metrics(
            conn=conn,
            page=page,
            page_size=page_size,
            class_id=class_id,
            is_active=is_active,
            search=search,
        )

    @classmethod
    def import_students_csv(
        cls,
        conn: sqlite3.Connection,
        csv_text: str,
        teacher_id: str | None = None,
    ) -> dict[str, Any]:
        """Import students in bulk from CSV content with strict security and validation.

        Validations:
        - Max file size (1 MB).
        - Max row limit (500 rows).
        - Protection against CSV formula injection.
        - Required columns: display_name, and class_name (or class_id).
        - School code duplicate prevention within file and against database.
        """
        raw_bytes = csv_text.encode("utf-8")
        if len(raw_bytes) > MAX_CSV_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"CSV exceeds maximum allowable size of {MAX_CSV_BYTES} bytes.",
                },
            )

        reader = csv.DictReader(io.StringIO(csv_text))
        if not reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_CSV",
                    "message": "CSV header is missing or empty.",
                },
            )

        # Normalize field names
        field_map = {fn.strip().lower(): fn for fn in reader.fieldnames}
        name_col = (
            field_map.get("display_name")
            or field_map.get("name")
            or field_map.get("student_name")
        )
        class_col = (
            field_map.get("class_name")
            or field_map.get("class")
            or field_map.get("class_id")
        )
        code_col = (
            field_map.get("school_student_code")
            or field_map.get("student_code")
            or field_map.get("code")
        )

        if not name_col or not class_col:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "MISSING_COLUMNS",
                    "message": "CSV must contain at least 'display_name' and 'class_name' columns.",
                },
            )

        # Cache existing classes by name and id
        all_classes = ClassesRepository.list_all(conn, active_only=False)
        class_by_name = {c["name"].lower(): c for c in all_classes}
        class_by_id = {c["class_id"]: c for c in all_classes}

        imported_students: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        seen_codes: set[str] = set()

        rows = list(reader)
        if len(rows) > MAX_CSV_ROWS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "ROW_LIMIT_EXCEEDED",
                    "message": f"CSV contains {len(rows)} rows, exceeding maximum limit of {MAX_CSV_ROWS}.",
                },
            )

        for row_idx, row in enumerate(rows, start=2):  # 1-indexed, header is row 1
            raw_name = row.get(name_col, "")
            raw_class = row.get(class_col, "")
            raw_code = row.get(code_col, "") if code_col else ""

            name_val = sanitize_csv_cell(raw_name) if raw_name else ""
            class_val = sanitize_csv_cell(raw_class) if raw_class else ""
            code_val = sanitize_csv_cell(raw_code) if raw_code else ""

            if not name_val:
                errors.append(
                    {"row": row_idx, "reason": "Missing student display_name."}
                )
                continue

            if not class_val:
                errors.append({"row": row_idx, "reason": "Missing class_name."})
                continue

            # Resolve or create class
            target_class = class_by_name.get(class_val.lower()) or class_by_id.get(
                class_val
            )
            if not target_class:
                # Auto-create class for seamless import
                created_class = ClassesRepository.create(
                    conn=conn,
                    name=class_val,
                    academic_year="2026-2027",
                    grade=None,
                    is_active=1,
                )
                target_class = created_class
                class_by_name[class_val.lower()] = target_class
                class_by_id[created_class["class_id"]] = target_class

            # Code duplication check
            student_code_final: str | None = None
            if code_val:
                if code_val in seen_codes:
                    errors.append(
                        {
                            "row": row_idx,
                            "reason": f"Duplicate student code '{code_val}' within file.",
                        }
                    )
                    continue
                seen_codes.add(code_val)

                existing_student = StudentsRepository.get_by_school_code(conn, code_val)
                if existing_student:
                    errors.append(
                        {
                            "row": row_idx,
                            "reason": f"Student code '{code_val}' already exists in database.",
                        }
                    )
                    continue
                student_code_final = code_val

            # Insert student & issue QR credential
            created_student = StudentsRepository.create(
                conn=conn,
                display_name=name_val,
                class_id=target_class["class_id"],
                school_student_code=student_code_final,
                is_active=1,
            )

            # Auto-issue QR credential
            CredentialService.issue_credential(
                conn=conn,
                student_id=created_student["student_id"],
                credential_type="QR",
                teacher_id=teacher_id,
            )

            imported_students.append(created_student)

        if imported_students:
            AuditService.record_students_imported(
                conn=conn,
                imported_count=len(imported_students),
                teacher_id=teacher_id,
            )

        return {
            "imported_count": len(imported_students),
            "skipped_count": len(errors),
            "errors": errors,
        }
