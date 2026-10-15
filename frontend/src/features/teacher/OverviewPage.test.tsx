import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { OverviewPage } from './OverviewPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { OverviewData } from '../../types/teacher';

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

const mockOverviewData: OverviewData = {
  metrics: {
    registered_students: 248,
    qualifying_washes: 1284,
    protocol_completion: {
      numerator: 1284,
      denominator: 1450,
      percentage: 88,
      period: '30d',
    },
    active_participants: 192,
    period: '30d',
  },
  activity_trend: [
    { date: '2026-10-10', total_sessions: 45, qualifying_washes: 40 },
    { date: '2026-10-11', total_sessions: 52, qualifying_washes: 48 },
  ],
  class_comparison: [
    {
      class_id: 'cls_1',
      class_name: 'Maple 3A',
      student_count: 24,
      qualifying_washes: 180,
      completion_rate: 90,
      washes_per_student: 7.5,
    },
  ],
  recent_activity: [
    {
      session_id: 'sess_123',
      student_id: 'stud_1',
      student_name: 'Alex Rivera',
      class_name: 'Maple 3A',
      started_at: '2026-10-14T08:30:00Z',
      outcome: 'completed-qualifying',
      qualifies_for_points: true,
      points_awarded: 10,
    },
  ],
  leaderboard_summary: [
    {
      rank: 1,
      student_id: 'stud_1',
      display_name: 'Alex R.',
      total_points: 120,
      qualifying_washes: 12,
    },
  ],
  device_status: {
    camera_connected: true,
    recognition_service_running: true,
    model_version: 'yolo11n-pose-handwash-v1.0',
    qr_scanner_available: true,
    database_status: 'healthy',
    timezone: 'UTC',
  },
};

describe('OverviewPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 4 KPI cards with real metrics and numerator/denominator', async () => {
    vi.spyOn(api, 'fetchOverviewApi').mockResolvedValueOnce({
      data: mockOverviewData,
      error: null,
      request_id: 'req_overview_1',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <OverviewPage onNavigateTab={vi.fn()} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('248')).toBeInTheDocument(); // Registered students
      expect(screen.getByText('1,284')).toBeInTheDocument(); // Qualifying washes
      expect(screen.getAllByText('88%').length).toBeGreaterThanOrEqual(1); // Completion percentage in KPI card & ring
      expect(screen.getByText('192')).toBeInTheDocument(); // Active participants
    });

    // Numerator and Denominator check
    expect(screen.getByText(/1284 of 1450 sessions qualified/i)).toBeInTheDocument();

    // Check Class comparison and Recent activity
    expect(screen.getAllByText('Maple 3A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+10 pts')).toBeInTheDocument();
  });

  it('renders a real empty state when the database contains no sessions or students', async () => {
    const emptyData: OverviewData = {
      metrics: {
        registered_students: 0,
        qualifying_washes: 0,
        protocol_completion: {
          numerator: 0,
          denominator: 0,
          percentage: 0,
          period: '30d',
        },
        active_participants: 0,
        period: '30d',
      },
      activity_trend: [],
      class_comparison: [],
      recent_activity: [],
      leaderboard_summary: [],
      device_status: {
        camera_connected: true,
        recognition_service_running: true,
        model_version: 'v1.0',
        qr_scanner_available: true,
        database_status: 'healthy',
        timezone: 'UTC',
      },
    };

    vi.spyOn(api, 'fetchOverviewApi').mockResolvedValueOnce({
      data: emptyData,
      error: null,
      request_id: 'req_empty',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <OverviewPage onNavigateTab={vi.fn()} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome to Bubsy!')).toBeInTheDocument();
      expect(screen.getByText(/No student handwashing activity has been recorded yet/i)).toBeInTheDocument();
    });
  });

  it('renders error state and retries on failure', async () => {
    vi.spyOn(api, 'fetchOverviewApi').mockResolvedValueOnce({
      data: null,
      error: { code: 'HTTP_500', message: 'Internal server error' },
      request_id: 'req_err',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <OverviewPage onNavigateTab={vi.fn()} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load overview')).toBeInTheDocument();
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('allows toggling accessible table view for activity trend chart', async () => {
    vi.spyOn(api, 'fetchOverviewApi').mockResolvedValueOnce({
      data: mockOverviewData,
      error: null,
      request_id: 'req_1',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <OverviewPage onNavigateTab={vi.fn()} />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Handwashing Activity Trend')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /accessible data table view/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('2026-10-10')).toBeInTheDocument();
    expect(screen.getByText('2026-10-11')).toBeInTheDocument();
  });
});
