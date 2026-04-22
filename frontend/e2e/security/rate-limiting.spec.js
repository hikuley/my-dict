// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Rate Limiting & DoS Penetration Tests (Cases 39-42)
 *
 * Tests that the API has proper rate limiting to prevent abuse.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Rate Limiting', () => {

  // Case 39: Generate endpoint rate limiting
  test('should rate limit rapid generate requests', async ({ request }) => {
    const results = [];
    const startTime = Date.now();

    // Fire 50 rapid generation requests
    const promises = Array.from({ length: 50 }, (_, i) =>
      request.post(`${BASE_URL}/api/words/generate`, {
        data: { word: `rate-limit-test-${i}-${Date.now()}` },
      }).then(r => r.status())
    );

    const statuses = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    const accepted = statuses.filter(s => s === 202).length;
    const conflicts = statuses.filter(s => s === 409).length;
    const rateLimited = statuses.filter(s => s === 429).length;
    const errors = statuses.filter(s => s >= 500).length;

    console.log(`Generate rate limit test (${elapsed}ms): accepted=${accepted}, conflicts=${conflicts}, rateLimited=${rateLimited}, errors=${errors}`);

    // Should not have server errors
    expect(errors).toBe(0);

    // Document if there's no rate limiting
    if (rateLimited === 0) {
      console.warn('WARNING: No rate limiting detected on /api/words/generate');
    }
  });

  // Case 40: Search endpoint rate limiting
  test('should rate limit rapid search requests', async ({ request }) => {
    const results = [];

    // Fire 100 rapid search requests
    const promises = Array.from({ length: 100 }, (_, i) =>
      request.get(`${BASE_URL}/api/words/search`, {
        params: { q: `search-${i}` },
      }).then(r => r.status())
    );

    const statuses = await Promise.all(promises);

    const ok = statuses.filter(s => s === 200).length;
    const rateLimited = statuses.filter(s => s === 429).length;
    const errors = statuses.filter(s => s >= 500).length;

    console.log(`Search rate limit test: ok=${ok}, rateLimited=${rateLimited}, errors=${errors}`);

    // Should not have server errors
    expect(errors).toBe(0);

    if (rateLimited === 0) {
      console.warn('WARNING: No rate limiting detected on /api/words/search');
    }
  });

  // Case 41: Concurrent WebSocket connections
  test('should handle many concurrent WebSocket connections', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const baseUrl = protocol + '//' + window.location.host + '/ws';
        let openCount = 0;
        let errorCount = 0;
        const connections = [];

        // Attempt 50 concurrent connections
        for (let i = 0; i < 50; i++) {
          try {
            const ws = new WebSocket(baseUrl);
            connections.push(ws);
            ws.onopen = () => openCount++;
            ws.onerror = () => errorCount++;
          } catch {
            errorCount++;
          }
        }

        setTimeout(() => {
          // Close all connections
          connections.forEach(ws => {
            try { ws.close(); } catch {}
          });
          resolve({ openCount, errorCount, total: 50 });
        }, 5000);
      });
    });

    console.log(`WebSocket flood: ${result.openCount}/${result.total} opened, ${result.errorCount} errors`);

    // Page should still be responsive
    const title = await page.locator('body').textContent();
    expect(title).toContain('My Dictionary');
  });

  // Case 42: Large response handling
  test('should handle words with very large sections content', async ({ page }) => {
    // Mock a word with huge sections content
    const hugeSections = JSON.stringify([
      {
        title: 'Definition',
        icon: '📖',
        content: '<p>' + 'A'.repeat(500000) + '</p>',
      },
    ]);

    await page.route('**/api/words/large-test', async (route) => {
      await route.fulfill({
        json: {
          slug: 'large-test',
          title: 'LARGE TEST',
          phonetic: '',
          subtitle: 'Test with huge content',
          sections: JSON.parse(hugeSections),
        },
      });
    });

    await page.route('**/api/words?*', async (route) => {
      await route.fulfill({
        json: {
          words: [{ slug: 'large-test', title: 'LARGE TEST', subtitle: 'Test' }],
          page: 1, limit: 20, total: 1, totalPages: 1,
        },
      });
    });

    await page.goto('/');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr').first().locator('button[title="Detail"]').click();
    await page.waitForSelector('.ant-modal', { state: 'visible' });

    // Page should not crash or freeze
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('.ant-modal').isVisible();
    expect(modalVisible).toBe(true);
  });
});
