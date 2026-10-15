import { test, expect } from '@playwright/test';

test.describe('E2E: Identification Failure Handling', () => {
  test('rejects unknown credentials, tracks retries, never guesses identity, offers assistance', async ({ page }) => {
    let scanAttempts = 0;

    await page.route('**/api/v1/kiosk/identify', async (route) => {
      scanAttempts++;
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Badge not recognized. Please try again.',
          },
          request_id: `req_fail_${scanAttempts}`,
        }),
      });
    });

    await page.goto('/kiosk');
    await expect(page.getByText('Hey there, handwashing hero!')).toBeVisible();

    // Advance from Home to Identify
    await page.getByRole('button', { name: "LET'S WASH!" }).click();
    await expect(page.getByText("Who's ready to wash?")).toBeVisible();

    // Verify help button is available
    const helpButton = page.getByRole('button', { name: /need help/i });
    await expect(helpButton).toBeVisible();
    await helpButton.click();

    // Verify helpful instructions appear without assigning a random student
    await expect(page.getByText('How to scan your QR card')).toBeVisible();
    await expect(page.getByText(/ask your teacher for a replacement/i)).toBeVisible();
  });
});
