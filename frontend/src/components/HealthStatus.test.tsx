import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HealthStatus } from './HealthStatus';

describe('HealthStatus Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays healthy status when backend API returns success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            status: 'healthy',
            app_name: 'Bubsy Handwashing Guidance System',
            version: '0.1.0',
            timestamp: '2026-10-13T21:56:42Z',
            environment: 'development',
          },
          error: null,
          request_id: 'req_abc123',
        }),
      }),
    );

    render(<HealthStatus />);

    // Initially displays loading state
    expect(screen.getByTestId('health-status-widget')).toBeInTheDocument();

    // Eventually resolves to healthy
    await waitFor(() => {
      expect(screen.getByTestId('icon-healthy')).toBeInTheDocument();
      expect(
        screen.getByText(/Healthy \(Bubsy Handwashing Guidance System v0.1.0/i),
      ).toBeInTheDocument();
    });
  });

  it('displays error badge when backend returns network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByTestId('icon-error')).toBeInTheDocument();
      expect(screen.getByText(/NETWORK_ERROR:/i)).toBeInTheDocument();
    });
  });
});
