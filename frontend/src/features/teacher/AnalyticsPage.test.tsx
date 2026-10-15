import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { AnalyticsPage } from './AnalyticsPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { AnalyticsData } from '../../types/teacher';

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

const mockAnalyticsData: AnalyticsData = {
  period: '30d',
  disclaimer:
    'AI technique recognition reflects protocol adherence and does not prove microbiological cleanliness or germ elimination.',
  daily_trends: [
    { date: '2026-10-10', total_sessions: 30, qualifying_sessions: 26, completion_rate: 87 },
  ],
  monthly_trends: [
    { month: '2026-10', total_sessions: 240, qualifying_sessions: 210 },
  ],
  completion_by_class: [
    {
      class_id: 'cls_1',
      class_name: 'Maple 3A',
      registered_students: 24,
      qualifying_washes: 120,
      completion_rate: 85,
      washes_per_student: 5.0,
    },
  ],
  participation_distribution: [
    { bucket_label: '6-15 washes', student_count: 18, percentage: 75 },
    { bucket_label: '16+ washes', student_count: 6, percentage: 25 },
  ],
  commonly_missed_steps: [
    {
      step_code: 'thumbs',
      step_name: 'Rotational Rubbing of Thumbs',
      total_attempts: 100,
      recognized_count: 70,
      uncertain_count: 20,
      retry_count: 10,
      skipped_count: 0,
      uncertainty_rate: 30,
    },
  ],
};

describe('AnalyticsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: [{ class_id: 'cls_1', name: 'Maple 3A', grade_level: '3', academic_year: '2026-2027', is_active: 1, created_at: '' }],
      error: null,
      request_id: 'req_c',
    });
  });

  it('displays the mandatory scientific and hygiene disclaimer banner prominently', async () => {
    vi.spyOn(api, 'fetchAnalyticsApi').mockResolvedValue({
      data: mockAnalyticsData,
      error: null,
      request_id: 'req_a',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AnalyticsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/AI technique recognition reflects protocol adherence and does not prove microbiological cleanliness/i),
      ).toBeInTheDocument();
    });
  });

  it('renders class completion normalized by class size and commonly missed steps', async () => {
    vi.spyOn(api, 'fetchAnalyticsApi').mockResolvedValue({
      data: mockAnalyticsData,
      error: null,
      request_id: 'req_a',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AnalyticsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Maple 3A').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('85% Completion')).toBeInTheDocument();
      expect(screen.getByText(/Rotational Rubbing of Thumbs/i)).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });
  });

  it('triggers CSV export on Export CSV button click', async () => {
    vi.spyOn(api, 'fetchAnalyticsApi').mockResolvedValue({
      data: mockAnalyticsData,
      error: null,
      request_id: 'req_a',
    });

    const exportSpy = vi.spyOn(api, 'downloadAnalyticsCsvApi').mockResolvedValueOnce(true);

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AnalyticsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Analytics & Compliance Reports')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export csv report/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith('mock-token', '30d', undefined);
      expect(screen.getByText(/CSV report downloaded successfully/i)).toBeInTheDocument();
    });
  });
});
