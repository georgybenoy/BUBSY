import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { WashSessionsPage } from './WashSessionsPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { SessionListItem, SessionDetailData } from '../../types/teacher';

const mockAuthValue = {
  user: {
    teacher_id: 'teach_1',
    username: 'ms_smith',
    role: 'teacher' as const,
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
  },
  token: 'mock-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

const mockSessions: SessionListItem[] = [
  {
    session_id: 'sess_1',
    student_id: 'stud_1',
    student_name: 'Alex Rivera',
    student_code: 'AR-101',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    kiosk_id: 'kiosk-sink-1',
    started_at: '2026-10-14T08:00:00Z',
    ended_at: '2026-10-14T08:00:45Z',
    duration_seconds: 45,
    outcome: 'completed',
    qualifies_for_points: true,
    points_awarded: 10,
    failure_reason: null,
    recognized_steps_count: 8,
    total_steps_count: 8,
    outcome_category: 'completed-qualifying',
  },
  {
    session_id: 'sess_2',
    student_id: 'stud_2',
    student_name: 'Jordan Lee',
    student_code: 'JL-102',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    kiosk_id: 'kiosk-sink-1',
    started_at: '2026-10-14T08:15:00Z',
    ended_at: '2026-10-14T08:15:20Z',
    duration_seconds: 20,
    outcome: 'incomplete',
    qualifies_for_points: false,
    points_awarded: 0,
    failure_reason: 'low_duration',
    recognized_steps_count: 3,
    total_steps_count: 8,
    outcome_category: 'incomplete',
  },
  {
    session_id: 'sess_3',
    student_id: 'stud_3',
    student_name: 'Taylor Swift',
    student_code: 'TS-103',
    class_id: 'cls_2',
    class_name: 'Oak 4B',
    kiosk_id: 'kiosk-sink-1',
    started_at: '2026-10-14T08:30:00Z',
    ended_at: '2026-10-14T08:30:35Z',
    duration_seconds: 35,
    outcome: 'uncertain',
    qualifies_for_points: false,
    points_awarded: 0,
    failure_reason: 'recognition_uncertain',
    recognized_steps_count: 5,
    total_steps_count: 8,
    outcome_category: 'recognition_uncertain',
  },
  {
    session_id: 'sess_4',
    student_id: null,
    student_name: null,
    student_code: null,
    class_id: null,
    class_name: null,
    kiosk_id: 'kiosk-sink-1',
    started_at: '2026-10-14T08:45:00Z',
    ended_at: null,
    duration_seconds: null,
    outcome: 'camera_error',
    qualifies_for_points: false,
    points_awarded: 0,
    failure_reason: 'CAMERA_READ_FAILED',
    recognized_steps_count: 0,
    total_steps_count: 8,
    outcome_category: 'device_failure',
  },
];

const mockSessionDetail: SessionDetailData = {
  session_id: 'sess_1',
  student_id: 'stud_1',
  student_name: 'Alex Rivera',
  student_code: 'AR-101',
  class_id: 'cls_1',
  class_name: 'Maple 3A',
  kiosk_id: 'kiosk-sink-1',
  started_at: '2026-10-14T08:00:00Z',
  ended_at: '2026-10-14T08:00:45Z',
  duration_seconds: 45,
  outcome: 'completed',
  qualifies_for_points: true,
  points_awarded: 10,
  failure_reason: null,
  protocol_version: 'who_six_step_v1',
  model_version: 'yolo11n-pose-handwash-v1.0',
  scoring_version: 'scoring_v1.0',
  outcome_category: 'completed-qualifying',
  uncertainty_reasons: [],
  expected_sequence: [
    { step_code: 'wet_hands', step_name: 'Wet Hands & Apply Soap', target_duration_seconds: 5 },
    { step_code: 'palm_to_palm', step_name: 'Palm to Palm Rubbing', target_duration_seconds: 5 },
  ],
  recognized_sequence: [
    {
      session_step_id: 'st_1',
      step_code: 'wet_hands',
      step_name: 'Wet Hands & Apply Soap',
      sequence_index: 0,
      result: 'recognized',
      duration_ms: 5500,
      confidence_summary: 0.94,
      created_at: '2026-10-14T08:00:05Z',
    },
    {
      session_step_id: 'st_2',
      step_code: 'palm_to_palm',
      step_name: 'Palm to Palm Rubbing',
      sequence_index: 1,
      result: 'recognized',
      duration_ms: 6000,
      confidence_summary: 0.91,
      created_at: '2026-10-14T08:00:11Z',
    },
  ],
  score_breakdown: {
    qualifies: true,
    points_awarded: 10,
    steps_recognized: 8,
    total_protocol_steps: 8,
    penalty_reasons: [],
  },
};

describe('WashSessionsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: [{ class_id: 'cls_1', name: 'Maple 3A', grade_level: '3', academic_year: '2026-2027', is_active: 1, created_at: '' }],
      error: null,
      request_id: 'req_cls',
    });
  });

  it('renders sessions list with outcome badges and ethical recognition notice', async () => {
    vi.spyOn(api, 'fetchSessionsApi').mockResolvedValueOnce({
      data: {
        items: mockSessions,
        total: 4,
        page: 1,
        limit: 15,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_sess_1',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <WashSessionsPage />
      </AuthContext.Provider>,
    );

    // Ethical notice check
    expect(
      screen.getByText(/Uncertain AI recognition indicates inconclusive camera or motion evidence/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
      expect(screen.getByText('Taylor Swift')).toBeInTheDocument();
    });

    // Check outcome badges
    expect(screen.getAllByText('Completed (Qualifying)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Incomplete').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Recognition Uncertain').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Device / Camera Failure').length).toBeGreaterThanOrEqual(1);
  });

  it('filters sessions when outcome dropdown changes', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchSessionsApi').mockResolvedValue({
      data: {
        items: [mockSessions[2]], // Recognition uncertain
        total: 1,
        page: 1,
        limit: 15,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_filter',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <WashSessionsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Wash Sessions')).toBeInTheDocument();
    });

    const outcomeSelect = screen.getByLabelText(/outcome/i);
    fireEvent.change(outcomeSelect, { target: { value: 'recognition_uncertain' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'mock-token',
        expect.objectContaining({ outcome: 'recognition_uncertain' }),
      );
    });
  });

  it('opens session detail dialog upon clicking Inspect', async () => {
    vi.spyOn(api, 'fetchSessionsApi').mockResolvedValueOnce({
      data: {
        items: [mockSessions[0]],
        total: 1,
        page: 1,
        limit: 15,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_s1',
    });

    vi.spyOn(api, 'fetchSessionDetailApi').mockResolvedValueOnce({
      data: mockSessionDetail,
      error: null,
      request_id: 'req_detail_1',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <WashSessionsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    });

    const inspectBtn = screen.getByRole('button', { name: /inspect session details for alex rivera/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText('Session Detail Inspection')).toBeInTheDocument();
      expect(screen.getByText(/Palm to Palm Rubbing/i)).toBeInTheDocument();
      expect(screen.getByText(/yolo11n-pose-handwash-v1.0/i)).toBeInTheDocument();
      expect(screen.getByText(/scoring_v1.0/i)).toBeInTheDocument();
      expect(screen.getByText(/Full protocol satisfied with all required Rubbing movements completed/i)).toBeInTheDocument();
    });
  });
});
