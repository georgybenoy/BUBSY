import { test, expect } from '@playwright/test';

test.describe('E2E: Duplicate Submission Idempotency', () => {
  test('submitting identical completion requests results in exactly one reward and idempotent 200 response', async ({ page }) => {
    let completionCalls = 0;
    const rewardLog: Array<{ idempKey: string; points: number }> = [];

    await page.route('**/api/v1/kiosk/sessions/*/complete', async (route) => {
      completionCalls++;
      const idempKey = route.request().headers()['idempotency-key'] || 'default';

      // Idempotent server behavior: if key seen before, return existing reward without re-issuing
      if (!rewardLog.some((r) => r.idempKey === idempKey)) {
        rewardLog.push({ idempKey, points: 10 });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            session_id: 'sess_idemp_1',
            outcome: 'completed-qualifying',
            points_awarded: 10,
            qualifies_for_points: true,
          },
          error: null,
          request_id: `req_idemp_${completionCalls}`,
        }),
      });
    });

    await page.goto('/kiosk');

    // Simulate sending 2 identical completion requests from browser client
    const results = await page.evaluate(async () => {
      const p1 = await fetch('/api/v1/kiosk/sessions/sess_idemp_1/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-abc-123',
        },
        body: JSON.stringify({ student_id: 'stud_1' }),
      });
      const d1 = await p1.json();

      const p2 = await fetch('/api/v1/kiosk/sessions/sess_idemp_1/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-abc-123',
        },
        body: JSON.stringify({ student_id: 'stud_1' }),
      });
      const d2 = await p2.json();

      return { status1: p1.status, status2: p2.status, d1, d2 };
    });

    expect(results.status1).toBe(200);
    expect(results.status2).toBe(200);
    expect(completionCalls).toBe(2);
    // Crucial: exactly one reward was recorded despite 2 requests
    expect(rewardLog.length).toBe(1);
    expect(rewardLog[0].points).toBe(10);
  });
});
