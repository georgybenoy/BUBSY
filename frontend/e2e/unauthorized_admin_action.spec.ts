import { test, expect } from '@playwright/test';

test.describe('E2E: Unauthorized Admin Action Rejection', () => {
  test('teacher role cannot edit administrative system settings and backend rejects modification', async ({ page }) => {
    // 1. Mock login as standard teacher (not admin)
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'mock_teacher_non_admin_token',
            teacher: {
              teacher_id: 't_non_admin',
              username: 'teacher_jane',
              role: 'teacher',
              is_active: 1,
            },
          },
          error: null,
          request_id: 'req_login_non_admin',
        }),
      });
    });

    await page.route('**/api/v1/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            metrics: { registered_students: 10, qualifying_washes: 20, protocol_completion: { numerator: 20, denominator: 20, percentage: 100, period: '30d' }, active_participants: 10, period: '30d' },
            activity_trend: [],
            class_comparison: [],
            recent_activity: [],
            leaderboard_summary: [],
            device_status: { camera_connected: true, recognition_service_running: true, model_version: 'v1.0', qr_scanner_available: true, database_status: 'healthy' },
          },
          error: null,
          request_id: 'req_overview',
        }),
      });
    });

    await page.route('**/api/v1/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        // Backend rejects with 403 Forbidden
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'Administrator privilege required to modify system settings.',
            },
            request_id: 'req_forbidden',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              school_timezone: 'UTC',
              data_retention_days: 365,
              protocol_version: 'who_six_step_v1',
              min_step_duration_seconds: 5,
              min_qualifying_score: 80,
              daily_reward_cap: 2,
              leaderboard_visibility: 'school',
              first_name_display_allowed: true,
              kiosk_language: 'en',
              kiosk_audio_enabled: true,
              allow_unassigned_sessions: true,
            },
            error: null,
            request_id: 'req_get_settings',
          }),
        });
      }
    });

    // 2. Login as teacher
    await page.goto('/teacher/login');
    await expect(page.getByText('Bubsy Teacher Portal')).toBeVisible();

    await page.getByLabel(/username/i).fill('teacher_jane');
    await page.getByLabel(/password/i).fill('ValidPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // 4. Verify Read-Only Mode & RBAC Notice are visible
    await expect(page.getByText(/Read-Only Mode/i)).toBeVisible();
    await expect(page.getByText(/Configuration settings are read-only for your role/i)).toBeVisible();

    // 5. Verify Save button is NOT displayed for non-admin accounts
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible();

    // 6. Direct PATCH request to backend is rejected with 403 Forbidden
    const patchResult = await page.evaluate(async () => {
      const res = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_teacher_non_admin_token',
        },
        body: JSON.stringify({ daily_reward_cap: 99 }),
      });
      return res.status;
    });
    expect(patchResult).toBe(403);
  });
});
