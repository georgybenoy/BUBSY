import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsPage } from './SettingsPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';
import type { SettingsData } from '../../types/teacher';

const mockAdminAuthValue = {
  user: {
    teacher_id: 'admin_1',
    username: 'admin_user',
    role: 'admin' as const,
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
  },
  token: 'mock-admin-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

const mockTeacherAuthValue = {
  user: {
    teacher_id: 'teacher_1',
    username: 'regular_teacher',
    role: 'teacher' as const,
    is_active: 1,
    created_at: '2026-10-10T00:00:00Z',
  },
  token: 'mock-teacher-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
};

const mockSettings: SettingsData = {
  school_timezone: 'UTC',
  protocol_version: 'who_six_step_v1',
  min_step_duration_seconds: 5,
  min_qualifying_score: 80,
  daily_reward_cap: 2,
  leaderboard_visibility: 'school',
  kiosk_language: 'en',
  kiosk_audio_enabled: true,
  first_name_display_allowed: true,
  allow_unassigned_sessions: true,
  data_retention_days: 365,
};

describe('SettingsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows administrator to edit and save system configuration', async () => {
    vi.spyOn(api, 'fetchSettingsApi').mockResolvedValueOnce({
      data: mockSettings,
      error: null,
      request_id: 'req_set',
    });

    const updateSpy = vi.spyOn(api, 'updateSettingsApi').mockResolvedValueOnce({
      data: { ...mockSettings, min_qualifying_score: 85 },
      error: null,
      request_id: 'req_up',
    });

    render(
      <AuthContext.Provider value={mockAdminAuthValue}>
        <SettingsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('System Settings & School Configuration')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    // Check Audit Policy Notice
    expect(
      screen.getByText(/Every update to system parameters is immutably logged in the audit events repository/i),
    ).toBeInTheDocument();

    const scoreInput = screen.getByLabelText(/minimum qualifying score/i);
    expect(scoreInput).not.toBeDisabled();
    fireEvent.change(scoreInput, { target: { value: '85' } });

    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'mock-admin-token',
        expect.objectContaining({ min_qualifying_score: 85 }),
      );
      expect(screen.getByText(/Settings updated successfully and recorded in audit log/i)).toBeInTheDocument();
    });
  });

  it('disables editing and presents read-only mode for non-admin teachers', async () => {
    vi.spyOn(api, 'fetchSettingsApi').mockResolvedValueOnce({
      data: mockSettings,
      error: null,
      request_id: 'req_set_2',
    });

    render(
      <AuthContext.Provider value={mockTeacherAuthValue}>
        <SettingsPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Read-Only Mode/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Configuration settings are read-only for your role/i),
      ).toBeInTheDocument();
    });

    const scoreInput = screen.getByLabelText(/minimum qualifying score/i);
    expect(scoreInput).toBeDisabled();

    expect(screen.queryByRole('button', { name: /save configuration/i })).not.toBeInTheDocument();
  });
});
