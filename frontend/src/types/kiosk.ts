export type KioskScreenState =
  | 'HOME'
  | 'IDENTIFY'
  | 'CONFIRM'
  | 'PREPARATION'
  | 'ACTIVE_WASH'
  | 'RESULT'
  | 'MY_PROGRESS'
  | 'ERROR';

export interface KioskConfig {
  kiosk_id: string;
  allow_unassigned_sessions: boolean;
  nfc_available: boolean;
  max_id_retries: number;
  first_name_display_allowed: boolean;
}

export interface KioskIdentifyResult {
  student_id: string;
  display_handle: string;
  first_name: string | null;
  retry_count: number;
  teacher_assistance_required: boolean;
}

export interface KioskSessionData {
  session_id: string;
  student_id: string | null;
  is_unassigned: boolean;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  state: string;
  protocol_version: string;
  current_step_code: string | null;
  current_step_index: number;
  total_steps: number;
  qualifies_for_points: boolean;
  duration_seconds: number | null;
}

export interface KioskCompleteSessionData {
  session_id: string;
  outcome: string;
  technique_score: number;
  points_awarded: number;
  qualifies_for_points: boolean;
  reason_code: string;
  duration_seconds: number;
  status: string;
  breakdown: Record<string, unknown>;
}

export interface KioskChildSafeEvent {
  session_id: string;
  step_code: string;
  sequence_index: number;
  step_number: number;
  total_steps: number;
  step_name: string;
  prompt_text: string;
  status_hint: 'GREAT_START' | 'KEEP_RUBBING' | 'TRY_SLOWER' | 'RETRY' | 'STEP_COMPLETED' | string;
  progress_ratio: number;
  is_verified_step: boolean;
  is_completed?: boolean;
}

export interface KioskBadge {
  achievement_id: string;
  name: string;
  description: string;
  awarded_at: string;
}

export interface KioskStudentProgress {
  student_id: string;
  display_handle: string;
  monthly_points: number;
  qualifying_sessions: number;
  badges: KioskBadge[];
  next_achievement?: {
    name: string;
    target_points: number;
    points_remaining: number;
  };
}

export interface KioskAccessibilitySettings {
  audioEnabled: boolean;
  textSize: 'standard' | 'large';
  language: 'en' | 'es';
}
