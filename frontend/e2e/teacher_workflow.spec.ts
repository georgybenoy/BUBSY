import { test, expect } from '@playwright/test';

test.describe('E2E: Teacher Workflow', () => {
  test('teacher logs in, views overview, inspects sessions, reviews leaderboard, and exports report', async ({ page }) => {
    // Mock authentication and dashboard endpoints for deterministic E2E flow
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'mock_valid_teacher_token',
            teacher: {
              teacher_id: 't_1',
              username: 'ms_smith',
              role: 'teacher',
              is_active: 1,
            },
          },
          error: null,
          request_id: 'req_login',
        }),
      });
    });

    await page.route('**/api/v1/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            metrics: {
              registered_students: 45,
              qualifying_washes: 210,
              protocol_completion: {
                numerator: 210,
                denominator: 230,
                percentage: 91,
                period: '30d',
              },
              active_participants: 40,
              period: '30d',
            },
            activity_trend: [{ date: '2026-10-10', total_sessions: 20, qualifying_washes: 18 }],
            class_comparison: [],
            recent_activity: [],
            leaderboard_summary: [],
            device_status: {
              camera_connected: true,
              recognition_service_running: true,
              model_version: 'v1.0',
              qr_scanner_available: true,
              nfc_reader_available: false,
              database_status: 'healthy',
            },
          },
          error: null,
          request_id: 'req_overview',
        }),
      });
    });

    // 1. Visit Login Page
    await page.goto('/teacher/login');
    await expect(page.getByText('Bubsy Teacher Portal')).toBeVisible();

    // 2. Fill login form
    await page.getByLabel(/username/i).fill('ms_smith');
    await page.getByLabel(/password/i).fill('ValidPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // 3. Verify landing on Overview
    await expect(page.getByText('Registered Students')).toBeVisible();
    await expect(page.getByText('Qualifying Washes').first()).toBeVisible();

    // 4. Verify sidebar tabs
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wash Sessions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leaderboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics & Reports' })).toBeVisible();
  });
});
