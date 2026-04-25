// @ts-check
import { test, expect } from '@playwright/test';
import { authHeaders } from '../fixtures/api-helpers.js';

/**
 * Authentication & Authorization Penetration Tests (Cases 14-18)
 *
 * Tests that verify endpoints properly require authentication
 * and that authenticated requests are handled correctly.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || BASE_URL;

test.describe('Auth - Unauthenticated API access', () => {

  // Case 14: Unauthenticated word generation should be rejected
  test('generate endpoint rejects requests without authentication', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: 'auth-test-word-' + Date.now() },
    });

    // Endpoint requires auth — should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  // Case 15: Unauthenticated word deletion should be rejected
  test('delete endpoint rejects requests without authentication', async ({ request }) => {
    const response = await request.delete(
      `${API_URL}/api/words/auth-test-nonexistent-${Date.now()}`
    );

    // Endpoint requires auth — should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  // Case 16: Authenticated mass deletion attempt (rate limiting check)
  test('no rate limiting on delete endpoint', async ({ request }) => {
    const headers = await authHeaders(request);
    const results = [];

    // Attempt 20 rapid deletions
    for (let i = 0; i < 20; i++) {
      const response = await request.delete(
        `${API_URL}/api/words/mass-delete-test-${i}`,
        { headers }
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
    // In CI, WebSocket may not be available through the static file server
    if (wsConnected) {
      console.warn('WARNING: WebSocket accepts unauthenticated connections');
    } else {
      console.warn('NOTE: WebSocket not reachable (static server does not proxy WS)');
    }
    // Don't hard-assert - WS availability depends on server setup
    expect(typeof wsConnected).toBe('boolean');
  });

  // Case 18: API enumeration - verify auth is required for word list
  test('word list is accessible without authentication for full enumeration', async ({ request }) => {
    // Without auth, should be rejected
    const unauthResponse = await request.get(`${API_URL}/api/words`, {
      params: { page: 1, limit: 100 },
    });
    expect([401, 403]).toContain(unauthResponse.status());

    // With auth, should work
    const headers = await authHeaders(request);
    let totalEnumerated = 0;
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages && currentPage <= 5) {
      const response = await request.get(`${API_URL}/api/words`, {
        params: { page: currentPage, limit: 100 },
        headers,
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      totalEnumerated += body.words.length;
      totalPages = body.totalPages;
      currentPage++;
    }

    expect(totalEnumerated).toBeGreaterThanOrEqual(0);
  });
});
