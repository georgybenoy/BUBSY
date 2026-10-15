-- Migration 0001: Initial Bubsy Database Schema
-- Strict adherence to docs/DATABASE.md specification

-- 1. classes
CREATE TABLE IF NOT EXISTS classes (
    class_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT,
    academic_year TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. students
CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    school_student_code TEXT UNIQUE,
    display_name TEXT NOT NULL,
    class_id TEXT NOT NULL REFERENCES classes(class_id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. credentials
CREATE TABLE IF NOT EXISTS credentials (
    credential_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL CHECK(credential_type IN ('QR', 'NFC')),
    credential_hash TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    revoked_at TEXT
);

-- 4. sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
    kiosk_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 0),
    outcome TEXT NOT NULL CHECK(outcome IN ('completed', 'incomplete', 'uncertain', 'cancelled', 'error')),
    protocol_version TEXT NOT NULL,
    model_version TEXT,
    qualifies_for_points INTEGER NOT NULL DEFAULT 0 CHECK(qualifies_for_points IN (0, 1)),
    failure_reason TEXT,
    created_at TEXT NOT NULL
);

-- 5. session_steps
CREATE TABLE IF NOT EXISTS session_steps (
    session_step_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    step_code TEXT NOT NULL,
    sequence_index INTEGER NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('recognized', 'retry', 'uncertain', 'skipped')),
    duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms >= 0),
    confidence_summary REAL CHECK(confidence_summary IS NULL OR (confidence_summary >= 0.0 AND confidence_summary <= 1.0)),
    created_at TEXT NOT NULL
);

-- 6. teachers
CREATE TABLE IF NOT EXISTS teachers (
    teacher_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'operator')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

-- 7. reward_transactions
CREATE TABLE IF NOT EXISTS reward_transactions (
    transaction_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
    points_delta INTEGER NOT NULL,
    reason_code TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    created_by_teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    notes TEXT
);

-- 8. achievements
CREATE TABLE IF NOT EXISTS achievements (
    achievement_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    criteria_json TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- 9. student_achievements
CREATE TABLE IF NOT EXISTS student_achievements (
    student_achievement_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES achievements(achievement_id) ON DELETE RESTRICT,
    awarded_at TEXT NOT NULL,
    source_key TEXT UNIQUE
);

-- 10. settings
CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE SET NULL
);

-- 11. audit_events
CREATE TABLE IF NOT EXISTS audit_events (
    audit_event_id TEXT PRIMARY KEY,
    teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    details_json TEXT
);

-- Indexes from docs/DATABASE.md Section 5
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_outcome ON sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_session_steps_session_id ON session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_student_id ON reward_transactions(student_id);
