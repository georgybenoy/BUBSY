/**
 * TypeScript interfaces for the teacher portal.
 */

export interface ProtocolCompletionMetric {
  numerator: number;
  denominator: number;
  percentage: number;
  period: string;
}

export interface OverviewMetrics {
  registered_students: number;
  qualifying_washes: number;
  protocol_completion: ProtocolCompletionMetric;
  active_participants: number;
  period: string;
}

export interface ActivityTrendPoint {
  date: string;
  total_sessions: number;
  qualifying_washes: number;
}

export interface ClassComparisonItem {
  class_id: string;
  class_name: string;
  student_count: number;
  qualifying_washes: number;
  completion_rate: number;
  washes_per_student: number;
}

export interface RecentActivityItem {
  session_id: string;
  student_id: string | null;
  student_name: string | null;
  class_name: string | null;
  started_at: string;
  outcome: string;
  qualifies_for_points: boolean;
  points_awarded: number;
}

export interface LeaderboardSummaryItem {
  rank: number;
  student_id: string;
  display_name: string;
  total_points: number;
  qualifying_washes: number;
}

export interface OverviewData {
  metrics: OverviewMetrics;
  activity_trend: ActivityTrendPoint[];
  class_comparison: ClassComparisonItem[];
  recent_activity: RecentActivityItem[];
  leaderboard_summary: LeaderboardSummaryItem[];
  device_status: {
    camera_connected: boolean;
    recognition_service_running: boolean;
    model_version: string;
    qr_scanner_available: boolean;
    database_status: string;
    timezone: string;
  };
}

export interface SessionListItem {
  session_id: string;
  student_id: string | null;
  student_name: string | null;
  student_code: string | null;
  class_id: string | null;
  class_name: string | null;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string;
  qualifies_for_points: boolean;
  points_awarded: number;
  failure_reason: string | null;
  recognized_steps_count: number;
  total_steps_count: number;
  outcome_category: 'completed-qualifying' | 'incomplete' | 'recognition_uncertain' | 'cancelled' | 'device_failure' | string;
}

export interface SessionListResponseData {
  items: SessionListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SessionStepDetail {
  session_step_id: string;
  step_code: string;
  step_name: string;
  sequence_index: number;
  result: 'recognized' | 'retry' | 'uncertain' | 'skipped';
  duration_ms: number | null;
  confidence_summary: number | null;
  created_at: string;
}

export interface SessionDetailData {
  session_id: string;
  student_id: string | null;
  student_name: string | null;
  student_code: string | null;
  class_id: string | null;
  class_name: string | null;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string;
  qualifies_for_points: boolean;
  points_awarded: number;
  failure_reason: string | null;
  protocol_version: string;
  model_version: string | null;
  scoring_version: string;
  outcome_category: string;
  uncertainty_reasons: string[];
  expected_sequence: Array<{ step_code: string; step_name: string; target_duration_seconds: number }>;
  recognized_sequence: SessionStepDetail[];
  score_breakdown: {
    qualifies: boolean;
    points_awarded: number;
    steps_recognized: number;
    total_protocol_steps: number;
    penalty_reasons: string[];
  };
}

export interface LeaderboardItem {
  rank: number;
  student_id: string;
  display_name: string;
  student_code: string | null;
  class_id: string;
  class_name: string;
  total_points: number;
  qualifying_washes: number;
  avg_technique_score: number;
}

export interface LeaderboardResponseData {
  items: LeaderboardItem[];
  month: string;
  timezone: string;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PointTransactionItem {
  transaction_id: string;
  student_id: string;
  student_name: string | null;
  session_id: string | null;
  points_delta: number;
  reason_code: string;
  created_at: string;
  notes: string | null;
  created_by_teacher_id: string | null;
}

export interface PointTransactionListResponseData {
  items: PointTransactionItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DailyTrendItem {
  date: string;
  total_sessions: number;
  qualifying_sessions: number;
  completion_rate: number;
}

export interface MonthlyTrendItem {
  month: string;
  total_sessions: number;
  qualifying_sessions: number;
}

export interface ClassCompletionItem {
  class_id: string;
  class_name: string;
  registered_students: number;
  qualifying_washes: number;
  completion_rate: number;
  washes_per_student: number;
}

export interface ParticipationBucket {
  bucket_label: string;
  student_count: number;
  percentage: number;
}

export interface CommonlyMissedStepItem {
  step_code: string;
  step_name: string;
  total_attempts: number;
  recognized_count: number;
  uncertain_count: number;
  retry_count: number;
  skipped_count: number;
  uncertainty_rate: number;
}

export interface AnalyticsData {
  period: string;
  disclaimer: string;
  daily_trends: DailyTrendItem[];
  monthly_trends: MonthlyTrendItem[];
  completion_by_class: ClassCompletionItem[];
  participation_distribution: ParticipationBucket[];
  commonly_missed_steps: CommonlyMissedStepItem[];
}

export interface SettingsData {
  school_timezone: string;
  protocol_version: string;
  min_step_duration_seconds: number;
  min_qualifying_score: number;
  daily_reward_cap: number;
  leaderboard_visibility: string;
  kiosk_language: string;
  kiosk_audio_enabled: boolean;
  first_name_display_allowed: boolean;
  allow_unassigned_sessions: boolean;
  data_retention_days: number;
}
