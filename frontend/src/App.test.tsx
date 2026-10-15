import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
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
          environment: 'test',
        },
        error: null,
        request_id: 'req_test123',
      }),
    }),
  );
});

describe('App Component Routing', () => {
  it('renders Kiosk layout by default on root route', async () => {
    render(<App />);

    // Assert kiosk header and elements
    expect(screen.getByText('The AI Handwashing Adventure')).toBeInTheDocument();
    expect(screen.getByText(/Ready for your wash adventure\?/i)).toBeInTheDocument();
    expect(screen.getByText("LET'S WASH!")).toBeInTheDocument();

    // Await async health check state update cleanly
    await waitFor(() => {
      expect(screen.getByTestId('icon-healthy')).toBeInTheDocument();
    });
  });
});
