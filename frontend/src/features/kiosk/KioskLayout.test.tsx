import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { KioskLayout } from './KioskLayout';
import * as api from '../../services/api';

// Mock API functions for isolated frontend tests
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    fetchKioskConfig: vi.fn(),
    identifyStudentApi: vi.fn(),
    createKioskSessionApi: vi.fn(),
    completeKioskSessionApi: vi.fn(),
    cancelKioskSessionApi: vi.fn(),
    getKioskStudentProgressApi: vi.fn(),
    getKioskWebSocketUrl: vi.fn().mockReturnValue('ws://127.0.0.1:8000/api/v1/kiosk/sessions/test-sess/events'),
  };
});

describe('Kiosk Layout and Screen Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchKioskConfig).mockResolvedValue({
      data: {
        kiosk_id: 'kiosk-1',
        allow_unassigned_sessions: true,
        nfc_available: true,
        max_id_retries: 3,
        first_name_display_allowed: true,
      },
      error: null,
      request_id: 'mock-config',
    });
  });

  it('renders the Home screen with Bubsy mascot, greeting, and LET’S WASH button', async () => {
    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hey there, handwashing hero!')).toBeInTheDocument();
    expect(screen.getByText('Ready for your wash adventure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "LET'S WASH!" })).toBeInTheDocument();
    expect(screen.getByText('Scan your student QR code to begin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voice Off' })).toBeInTheDocument();
  });

  it('toggles audio voice guidance and text size on the Home screen', async () => {
    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    const voiceBtn = screen.getByRole('button', { name: 'Voice Off' });
    fireEvent.click(voiceBtn);
    expect(screen.getByRole('button', { name: 'Voice On' })).toBeInTheDocument();

    const textBtn = screen.getByRole('button', { name: 'Text: Normal' });
    fireEvent.click(textBtn);
    expect(screen.getByRole('button', { name: 'Text: Large' })).toBeInTheDocument();
  });

  it('navigates to Identify screen when clicking LET’S WASH!', async () => {
    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: "LET'S WASH!" }));

    await waitFor(() => {
      expect(screen.getByText("Who's ready to wash?")).toBeInTheDocument();
      expect(screen.getByText('Hold your student QR code inside the box.')).toBeInTheDocument();
      expect(screen.getByText('Camera Scanning Active')).toBeInTheDocument();
      expect(screen.getByText('Or tap your student card')).toBeInTheDocument();
    });
  });

  it('handles failed scans, increments attempts, and shows teacher assistance option', async () => {
    vi.mocked(api.identifyStudentApi).mockResolvedValue({
      data: null,
      error: { code: 'CREDENTIAL_NOT_FOUND', message: 'Unknown student token.' },
      request_id: 'err-1',
    });

    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: "LET'S WASH!" }));

    // Type token into emulator input
    const input = screen.getByLabelText('Scan or enter QR token');
    const scanBtn = screen.getByRole('button', { name: 'Scan' });

    // Attempt 1
    fireEvent.change(input, { target: { value: 'bad_token_1' } });
    fireEvent.click(scanBtn);
    await waitFor(() => {
      expect(screen.getByText(/Unknown student token/)).toBeInTheDocument();
    });

    // Attempt 2
    fireEvent.change(input, { target: { value: 'bad_token_2' } });
    fireEvent.click(scanBtn);
    await waitFor(() => {
      expect(screen.getByText(/Attempt 2\/3/)).toBeInTheDocument();
    });

    // Attempt 3: threshold reached -> shows Teacher Assistance and Wash Without Saving Points
    fireEvent.change(input, { target: { value: 'bad_token_3' } });
    fireEvent.click(scanBtn);
    await waitFor(() => {
      expect(screen.getByText('Having trouble scanning?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Teacher Assistance' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Wash Without Saving Points' })).toBeInTheDocument();
    });
  });

  it('completes the full happy-path flow: Identify -> Confirm -> Prep -> Wash -> Result', async () => {
    vi.mocked(api.identifyStudentApi).mockResolvedValue({
      data: {
        student_id: 'std-101',
        display_handle: 'Liam',
        first_name: 'Liam',
        retry_count: 0,
        teacher_assistance_required: false,
      },
      error: null,
      request_id: 'mock-id',
    });

    vi.mocked(api.createKioskSessionApi).mockResolvedValue({
      data: {
        session_id: 'sess-abc',
        student_id: 'std-101',
        is_unassigned: false,
        kiosk_id: 'kiosk-1',
        started_at: '2026-10-14T00:00:00Z',
        ended_at: null,
        state: 'in_progress',
        protocol_version: '1.0.0',
        current_step_code: 'STEP_1',
        current_step_index: 0,
        total_steps: 6,
        qualifies_for_points: true,
        duration_seconds: 0,
      },
      error: null,
      request_id: 'mock-create',
    });

    vi.mocked(api.completeKioskSessionApi).mockResolvedValue({
      data: {
        session_id: 'sess-abc',
        outcome: 'completed',
        technique_score: 100.0,
        points_awarded: 15,
        qualifies_for_points: true,
        reason_code: 'VALIDATED_COMPLETION',
        duration_seconds: 40,
        status: 'awarded',
        breakdown: {},
      },
      error: null,
      request_id: 'mock-comp',
    });

    vi.mocked(api.getKioskStudentProgressApi).mockResolvedValue({
      data: {
        student_id: 'std-101',
        display_handle: 'Liam',
        monthly_points: 60,
        qualifying_sessions: 4,
        badges: [
          { achievement_id: 'b1', name: 'Bubble Master', description: 'Washed 4 times', awarded_at: '2026-10-14' },
        ],
        next_achievement: { name: 'Super Star', target_points: 100, points_remaining: 40 },
      },
      error: null,
      request_id: 'mock-prog',
    });

    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    // 1. Home -> Identify
    fireEvent.click(screen.getByRole('button', { name: "LET'S WASH!" }));

    // 2. Scan valid credential
    const input = screen.getByLabelText('Scan or enter QR token');
    fireEvent.change(input, { target: { value: 'valid_qr_token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));

    // 3. Confirm Screen
    await waitFor(() => {
      expect(screen.getByText('Ready, Liam?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: "YES, LET'S GO!" }));

    // 4. Preparation Screen
    await waitFor(() => {
      expect(screen.getByText('Preparation Instructions')).toBeInTheDocument();
      expect(screen.getByText('1. Wet your hands')).toBeInTheDocument();
      expect(screen.getByText('2. Apply soap')).toBeInTheDocument();
    });
    // Click Ready to advance to Active Wash
    const readyBtn = screen.getByRole('button', { name: /I'm Ready!/i });
    fireEvent.click(readyBtn);

    // 5. Active Wash Screen
    await waitFor(() => {
      expect(screen.getByText('Your Wash Adventure')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
      expect(screen.getByText('Rub your palms together!')).toBeInTheDocument();
    });

    // 6. Finish Washing
    const finishBtn = screen.getByRole('button', { name: 'NEXT STEP' });
    fireEvent.click(finishBtn);

    // 7. Result Screen
    await waitFor(() => {
      expect(screen.getByText('You did it!')).toBeInTheDocument();
      expect(screen.getByText('You earned 15 Bubsy Points!')).toBeInTheDocument();
      expect(screen.getByText('Clean hands, happy days!')).toBeInTheDocument();
    });

    // 8. View My Progress Screen
    fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));
    await waitFor(() => {
      expect(screen.getByText('My Handwashing Journey')).toBeInTheDocument();
      expect(screen.getByText('Great work, Liam!')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument(); // points
      expect(screen.getByText('Bubble Master')).toBeInTheDocument(); // badge
    });

    // 9. Back to Home
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    await waitFor(() => {
      expect(screen.getByText('Hey there, handwashing hero!')).toBeInTheDocument();
    });
  });

  it('shows supportive messaging for incomplete or unverified sessions with zero misleading points', async () => {
    vi.mocked(api.createKioskSessionApi).mockResolvedValue({
      data: {
        session_id: 'sess-incomplete',
        student_id: null,
        is_unassigned: true,
        kiosk_id: 'kiosk-1',
        started_at: '2026-10-14T00:00:00Z',
        ended_at: null,
        state: 'in_progress',
        protocol_version: '1.0.0',
        current_step_code: 'STEP_1',
        current_step_index: 0,
        total_steps: 6,
        qualifies_for_points: false,
        duration_seconds: 0,
      },
      error: null,
      request_id: 'm1',
    });

    vi.mocked(api.completeKioskSessionApi).mockResolvedValue({
      data: {
        session_id: 'sess-incomplete',
        outcome: 'incomplete',
        technique_score: 40.0,
        points_awarded: 0,
        qualifies_for_points: false,
        reason_code: 'INCOMPLETE_SESSION',
        duration_seconds: 15,
        status: 'not_qualified',
        breakdown: {},
      },
      error: null,
      request_id: 'm2',
    });

    vi.mocked(api.identifyStudentApi).mockResolvedValue({
      data: null,
      error: { code: 'FAIL', message: 'Fail' },
      request_id: 'e',
    });

    render(
      <MemoryRouter>
        <KioskLayout />
      </MemoryRouter>,
    );

    // Go to identify and choose unassigned
    fireEvent.click(screen.getByRole('button', { name: "LET'S WASH!" }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // Back to home
    await waitFor(() => {
      expect(screen.getByRole('button', { name: "LET'S WASH!" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: "LET'S WASH!" }));

    // Trigger unassigned directly
    await waitFor(() => {
      expect(screen.getByLabelText('Scan or enter QR token')).toBeInTheDocument();
    });
    const input = screen.getByLabelText('Scan or enter QR token');
    for (let i = 0; i < 3; i++) {
      fireEvent.change(input, { target: { value: `fail-${i}` } });
      fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
      if (i < 2) {
        await waitFor(() => {
          expect(screen.getByText(new RegExp(`Attempt ${i + 1}/3`))).toBeInTheDocument();
        });
      }
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Wash Without Saving Points' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wash Without Saving Points' }));

    // On Prep screen
    await waitFor(() => {
      expect(screen.getByText('Preparation Instructions')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /I'm Ready!/i }));

    // On Active Wash screen
    await waitFor(() => {
      expect(screen.getByText('Your Wash Adventure')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'NEXT STEP' }));

    // On Result screen
    await waitFor(() => {
      expect(screen.getByText('Good effort!')).toBeInTheDocument();
      expect(screen.queryByText(/You earned 15 Bubsy Points!/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'DONE' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'DONE' }));
    await waitFor(() => {
      expect(screen.getByText('Hey there, handwashing hero!')).toBeInTheDocument();
    });
  });
});
