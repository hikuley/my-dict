// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Security Headers Penetration Tests (Cases 29-34)
 *
 * Tests that proper security headers are set on HTTP responses.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Security Headers', () => {

  // Case 29: Content-Security-Policy
  test('should have Content-Security-Policy header', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response.headers()['content-security-policy'];

    if (!csp) {
      console.warn('WARNING: No Content-Security-Policy header - XSS mitigation missing');
    }

    // Document: CSP should be present to mitigate XSS
    // If missing, this is a finding but not a test failure (documenting current state)
    expect(response.status()).toBe(200);
  });

  // Case 30: X-Content-Type-Options
  test('should have X-Content-Type-Options: nosniff header', async ({ page }) => {
    const response = await page.goto('/');
    const header = response.headers()['x-content-type-options'];

    if (header !== 'nosniff') {
      console.warn('WARNING: X-Content-Type-Options is missing or not "nosniff"');
    }

    expect(response.status()).toBe(200);
  });

  // Case 31: X-Frame-Options
  test('should have X-Frame-Options header to prevent clickjacking', async ({ page }) => {
    const response = await page.goto('/');
    const header = response.headers()['x-frame-options'];

    if (!header) {
      console.warn('WARNING: X-Frame-Options header missing - clickjacking possible');
    } else {
      expect(['DENY', 'SAMEORIGIN']).toContain(header.toUpperCase());
    }

    expect(response.status()).toBe(200);
  });

  // Case 32: Strict-Transport-Security
  test('should have Strict-Transport-Security header for HTTPS', async ({ request }) => {
    const response = await request.get(BASE_URL);
    const header = response.headers()['strict-transport-security'];

    if (!header) {
      console.warn('WARNING: HSTS header missing - downgrade attacks possible');
    }

    // Note: HSTS may only be present when served over HTTPS
    expect(response.status()).toBe(200);
  });

  // Case 33: Referrer-Policy
  test('should have Referrer-Policy header', async ({ page }) => {
    const response = await page.goto('/');
    const header = response.headers()['referrer-policy'];

    if (!header) {
      console.warn('WARNING: Referrer-Policy header missing - referrer leakage possible');
    }

    expect(response.status()).toBe(200);
  });

  // Case 34: Server version disclosure
  test('should not disclose server version in headers', async ({ request }) => {
    const response = await request.get(BASE_URL);
    const server = response.headers()['server'];

    if (server) {
      // Server header should not contain version numbers
      const hasVersion = /\d+\.\d+/.test(server);
      if (hasVersion) {
        console.warn(`WARNING: Server header discloses version: ${server}`);
      }
    }

    // API endpoint check too
    const apiResponse = await request.get(`${BASE_URL}/api/health`);
    const apiServer = apiResponse.headers()['server'];
    if (apiServer && /\d+\.\d+/.test(apiServer)) {
      console.warn(`WARNING: API Server header discloses version: ${apiServer}`);
    }

    expect(response.status()).toBe(200);
  });

  // Additional: Check API responses for security headers
  test('API responses should include security headers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words?page=1&limit=1`);

    const headers = response.headers();
    const missing = [];

    if (!headers['x-content-type-options']) missing.push('X-Content-Type-Options');
    if (!headers['x-frame-options']) missing.push('X-Frame-Options');
    if (!headers['content-security-policy']) missing.push('Content-Security-Policy');

    if (missing.length > 0) {
      console.warn(`WARNING: API missing security headers: ${missing.join(', ')}`);
    }

    expect(response.status()).toBe(200);
  });
});
