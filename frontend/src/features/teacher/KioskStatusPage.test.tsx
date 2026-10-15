import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { KioskStatusPage } from './KioskStatusPage';
import { AuthContext } from '../../context/auth-context-base';
import * as api from '../../services/api';

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

describe('KioskStatusPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders hardware subsystem telemetry and device failure vs recognition uncertainty distinction', async () => {
    vi.spyOn(api, 'fetchHealth').mockResolvedValueOnce({
      data: {
        status: 'ok',
        app_name: 'Bubsy Kiosk Backend',
        version: '1.0.0',
        timestamp: '2026-10-14T08:00:00Z',
        environment: 'development',
      },
      error: null,
      request_id: 'req_h',
    });

    vi.spyOn(api, 'fetchOverviewApi').mockResolvedValueOnce({
      data: {
        metrics: {
          registered_students: 10,
          qualifying_washes: 20,
          protocol_completion: { numerator: 20, denominator: 25, percentage: 80, period: '30d' },
          active_participants: 8,
          period: '30d',
        },
        activity_trend: [],
        class_comparison: [],
        recent_activity: [],
        leaderboard_summary: [],
        device_status: {
          camera_connected: true,
          recognition_service_running: true,
          model_version: 'yolo11n-pose-handwash-v1.0',
          qr_scanner_available: true,
          database_status: 'healthy',
          timezone: 'UTC',
        },
      },
      error: null,
      request_id: 'req_o',
    });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <KioskStatusPage />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Camera Sensor')).toBeInTheDocument();
      expect(screen.getByText('AI Gesture Engine')).toBeInTheDocument();
      expect(screen.getByText('QR Credential Scanner')).toBeInTheDocument();
      expect(screen.getByText('SQLite Database')).toBeInTheDocument();
    });

    // Subsystem status badges
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('healthy')).toBeInTheDocument();

    // Check distinction notice
    expect(
      screen.getByText(/A broken webcam, offline vision runner, or corrupted model represents a/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Device Failure')).toBeInTheDocument();
    expect(screen.getByText('Recognition Uncertainty')).toBeInTheDocument();
  });
});
