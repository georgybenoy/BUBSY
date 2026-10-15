import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { LeaderboardPage } from './LeaderboardPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { LeaderboardItem, PointTransactionItem } from '../../types/teacher';

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

const mockLeaderboardItems: LeaderboardItem[] = [
  {
    rank: 1,
    student_id: 'stud_1',
    display_name: 'Alex Rivera',
    student_code: 'AR-101',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    total_points: 150,
    qualifying_washes: 15,
    avg_technique_score: 95.0,
  },
  {
    rank: 2,
    student_id: 'stud_2',
    display_name: 'Jordan Lee',
    student_code: 'JL-102',
    class_id: 'cls_1',
    class_name: 'Maple 3A',
    total_points: 120,
    qualifying_washes: 12,
    avg_technique_score: 92.5,
  },
  {
    rank: 3,
    student_id: 'stud_3',
    display_name: 'Taylor Swift',
    student_code: 'TS-103',
    class_id: 'cls_2',
    class_name: 'Oak 4B',
    total_points: 100,
    qualifying_washes: 10,
    avg_technique_score: 88.0,
  },
];

const mockTransactions: PointTransactionItem[] = [
  {
    transaction_id: 'tx_1',
    student_id: 'stud_1',
    student_name: 'Alex Rivera',
    session_id: 'sess_1',
    points_delta: 10,
    reason_code: 'qualifying_wash',
    created_at: '2026-10-14T08:00:00Z',
    notes: 'Qualifying wash session',
    created_by_teacher_id: null,
  },
];

describe('LeaderboardPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'fetchClassesApi').mockResolvedValue({
      data: [{ class_id: 'cls_1', name: 'Maple 3A', grade_level: '3', academic_year: '2026-2027', is_active: 1, created_at: '' }],
      error: null,
      request_id: 'req_c',
    });
  });

  it('renders top 3 podium and standings with tie-break rules explanation', async () => {
    vi.spyOn(api, 'fetchLeaderboardApi').mockResolvedValueOnce({
      data: {
        items: mockLeaderboardItems,
        month: '2026-10',
        timezone: 'UTC',
        total: 3,
        page: 1,
        limit: 50,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_lead',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LeaderboardPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('150 pts').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Gold Champion')).toBeInTheDocument();
    });

    // Check tie-break rules explanation
    expect(
      screen.getByText(/Ties are broken systematically per school protocol/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Highest points/i)).toBeInTheDocument();
    expect(screen.getByText(/More qualifying washes/i)).toBeInTheDocument();
  });

  it('opens point audit dialog and creates a compensating transaction', async () => {
    vi.spyOn(api, 'fetchLeaderboardApi').mockResolvedValue({
      data: {
        items: mockLeaderboardItems,
        month: '2026-10',
        timezone: 'UTC',
        total: 3,
        page: 1,
        limit: 50,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_lead',
    });

    vi.spyOn(api, 'fetchPointTransactionsApi').mockResolvedValueOnce({
      data: {
        items: mockTransactions,
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      },
      error: null,
      request_id: 'req_tx',
    });

    const correctionSpy = vi.spyOn(api, 'submitPointCorrectionApi').mockResolvedValueOnce({
      data: {
        transaction_id: 'tx_corr_1',
        student_id: 'stud_1',
        points_delta: 10,
        new_monthly_total: 160,
      },
      error: null,
      request_id: 'req_corr',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LeaderboardPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThanOrEqual(1);
    });

    const auditBtn = screen.getAllByRole('button', { name: /audit points for alex rivera/i })[0];
    fireEvent.click(auditBtn);

    await waitFor(() => {
      expect(screen.getByText(/Point Transactions: Alex Rivera/i)).toBeInTheDocument();
      expect(screen.getByText('Immutable Point Transaction Ledger')).toBeInTheDocument();
    });

    const createCorrectionBtn = screen.getByRole('button', { name: /create compensating correction/i });
    fireEvent.click(createCorrectionBtn);

    const deltaInput = screen.getByLabelText(/point delta/i);
    fireEvent.change(deltaInput, { target: { value: '10' } });

    const notesInput = screen.getByLabelText(/audit notes \/ justification/i);
    fireEvent.change(notesInput, { target: { value: 'Manual teacher credit for kiosk camera disconnect' } });

    const submitBtn = screen.getByRole('button', { name: /apply correction/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(correctionSpy).toHaveBeenCalledWith(
        'mock-token',
        expect.objectContaining({
          student_id: 'stud_1',
          points_delta: 10,
          reason: 'kiosk_hardware_issue',
          notes: 'Manual teacher credit for kiosk camera disconnect',
        }),
      );
      expect(screen.getByText(/Successfully adjusted points by \+10/i)).toBeInTheDocument();
    });
  });
});
