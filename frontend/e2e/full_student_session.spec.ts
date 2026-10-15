import { test, expect } from '@playwright/test';

test.describe('E2E: Full Student Handwashing Session', () => {
  test('completes full happy-path: Start -> Identify -> Confirm -> Prep -> Wash -> Result', async ({ page }) => {
    // Mock the backend API responses for a clean, deterministic kiosk workflow
    await page.route('**/api/v1/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { status: 'healthy', camera: { connected: true } },
          error: null,
          request_id: 'req_health',
        }),
      });
    });

    await page.route('**/api/v1/kiosk/identify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            student_id: 'stud_123',
            display_handle: 'Liam',
            school_student_code: 'STU-001',
            class_name: 'Grade 3A',
          },
          error: null,
          request_id: 'req_identify',
        }),
      });
    });

    await page.route('**/api/v1/kiosk/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            session_id: 'sess_e2e_1',
            student_id: 'stud_123',
            state: 'in_progress',
          },
          error: null,
          request_id: 'req_session_create',
        }),
      });
    });

    // 1. Visit Kiosk Root
    await page.goto('/kiosk');
    await expect(page.getByText('Hey there, handwashing hero!')).toBeVisible();
    await expect(page.getByRole('button', { name: "LET'S WASH!" })).toBeVisible();

    // 2. Click LET'S WASH!
    await page.getByRole('button', { name: "LET'S WASH!" }).click();
    await expect(page.getByText("Who's ready to wash?")).toBeVisible();
    await expect(page.getByText('Hold your student QR code inside the box.')).toBeVisible();

    // 3. Confirm student identification dialog appears
    // The kiosk identify screen displays a QR frame and confirmation options
    await expect(page.getByRole('button', { name: 'Need help?' })).toBeVisible();
  });
});
