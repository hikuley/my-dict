// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Authentication & Authorization Penetration Tests (Cases 14-18)
 *
 * Tests that verify the lack of authentication/authorization controls
 * and document the security risks of unprotected endpoints.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Auth - Unauthenticated API access', () => {

  // Case 14: Unauthenticated word generation
  test('generate endpoint accepts requests without authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: 'auth-test-word-' + Date.now() },
    });

    // Document: this endpoint has no auth - should ideally require authentication
    // Current behavior: accepts unauthenticated requests
    expect([202, 409]).toContain(response.status());
  });

  // Case 15: Unauthenticated word deletion
  test('delete endpoint accepts requests without authentication', async ({ request }) => {
    // Try to delete a non-existent word - testing that the endpoint is accessible
    const response = await request.delete(
      `${BASE_URL}/api/words/auth-test-nonexistent-${Date.now()}`
    );

    // Document: delete endpoint has no auth - should require authentication
    // Current behavior: returns 404 (accessible without auth)
    expect(response.status()).toBe(404);
  });

  // Case 16: Mass deletion attempt (rate limiting check)
  test('no rate limiting on delete endpoint', async ({ request }) => {
    const results = [];

    // Attempt 20 rapid deletions
    for (let i = 0; i < 20; i++) {
      const response = await request.delete(
        `${BASE_URL}/api/words/mass-delete-test-${i}`
      );
      results.push(response.status());
    }

    // Document: if all return 404 (not 429), there's no rate limiting
    const has429 = results.some(s => s === 429);
    const allAccessible = results.every(s => s === 404 || s === 200);

    // This test documents the absence of rate limiting
    if (!has429) {
      console.warn('WARNING: No rate limiting detected on DELETE endpoint');
    }
    expect(allAccessible || has429).toBe(true);
  });

  // Case 17: Unauthenticated WebSocket connection
  test('WebSocket accepts connections without authentication', async ({ page }) => {
    await page.goto('/');

    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + window.location.host + '/ws');

        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);

        setTimeout(() => resolve(false), 5000);
      });
    });

    // Document: WebSocket has no auth - should ideally require a token
    if (wsConnected) {
      console.warn('WARNING: WebSocket accepts unauthenticated connections');
    }
    expect(wsConnected).toBe(true); // Documenting current (insecure) behavior
  });

  // Case 18: API enumeration - dump all words without auth
  test('word list is accessible without authentication for full enumeration', async ({ request }) => {
    let totalEnumerated = 0;
    let currentPage = 1;
    let totalPages = 1;

    // Enumerate up to 5 pages
    while (currentPage <= totalPages && currentPage <= 5) {
      const response = await request.get(`${BASE_URL}/api/words`, {
        params: { page: currentPage, limit: 100 },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      totalEnumerated += body.words.length;
      totalPages = body.totalPages;
      currentPage++;
    }

    // Document: entire dictionary is enumerable without auth
    if (totalEnumerated > 0) {
      console.warn(`WARNING: Enumerated ${totalEnumerated} words without authentication`);
    }
    expect(totalEnumerated).toBeGreaterThanOrEqual(0);
  });
});
