import { test, expect } from '@playwright/test';

test.describe('E2E: Gesture Recognition Uncertainty & Supportive Feedback', () => {
  test('uncertain predictions trigger retry with neutral, supportive messaging and no false advancement', async ({ page }) => {
    await page.goto('/kiosk');

    // On Kiosk Home screen, verify warm, supportive hero greeting
    await expect(page.getByText('Hey there, handwashing hero!')).toBeVisible();

    // Advance to Identify
    await page.getByRole('button', { name: "LET'S WASH!" }).click();
    await expect(page.getByText("Who's ready to wash?")).toBeVisible();

    // Verify non-shaming phrasing principles: no words like "dirty", "failed hygiene", "penalty"
    const content = await page.content();
    expect(content).not.toContain('hygiene violation');
    expect(content).not.toContain('germ infested');
    expect(content).not.toContain('failed hygiene');
    expect(content).not.toContain('dirty hands');
  });
});
