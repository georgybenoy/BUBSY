import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { LoginPage } from './LoginPage';

describe('LoginPage Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders accessible form elements with associated labels', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    // Assert main header
    expect(screen.getByRole('heading', { name: /Bubsy Teacher Portal/i })).toBeInTheDocument();

    // Assert input fields have accessible labels linked via htmlFor/id
    const usernameInput = screen.getByLabelText(/Username/i);
    expect(usernameInput).toBeInTheDocument();
    expect(usernameInput).toHaveAttribute('type', 'text');

    const passwordInput = screen.getByLabelText(/Password/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit button disabled when empty
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });
    expect(submitBtn).toBeDisabled();

    // Link back to kiosk
    expect(screen.getByRole('link', { name: /Return to Student Kiosk/i })).toBeInTheDocument();
  });

  it('enables submit button after typing username and password', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    await user.type(usernameInput, 'mrs_smith');
    await user.type(passwordInput, 'SchoolPass123!');

    expect(usernameInput).toHaveValue('mrs_smith');
    expect(passwordInput).toHaveValue('SchoolPass123!');
    expect(submitBtn).toBeEnabled();
  });

  it('displays accessible error alert with role="alert" when credentials fail', async () => {
    const user = userEvent.setup();

    // Mock failed fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          data: null,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password.',
          },
          request_id: 'req_err_123',
        }),
      }),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    await user.type(usernameInput, 'wrong_user');
    await user.type(passwordInput, 'wrong_pass');
    await user.click(submitBtn);

    // Assert error alert has role="alert" and text (accessible, not color-only)
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Sign-in Problem/i);
      expect(alert).toHaveTextContent(/Invalid username or password\./i);
    });
  });

  it('successfully logs in with valid credentials and saves token in sessionStorage', async () => {
    const user = userEvent.setup();

    // Mock successful fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            token: 'valid_session_token_123',
            csrf_token: 'valid_csrf_token_123',
            teacher: {
              teacher_id: 'teach-001',
              username: 'demo_teacher',
              role: 'teacher',
              is_active: 1,
              created_at: '2026-10-13T22:00:00Z',
            },
          },
          error: null,
          request_id: 'req_success_123',
        }),
      }),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    );

    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign in/i });

    await user.type(usernameInput, 'demo_teacher');
    await user.type(passwordInput, 'DemoPass123!');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(sessionStorage.getItem('bubsy_auth_token')).toBe('valid_session_token_123');
    });
  });
});
