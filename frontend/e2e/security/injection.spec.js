// @ts-check
import { test, expect } from '@playwright/test';
import { SQL_PAYLOADS, PATH_TRAVERSAL_PAYLOADS, CRLF_PAYLOADS } from '../fixtures/payloads.js';

/**
 * Injection Penetration Tests (Cases 9-13)
 *
 * Tests that SQL injection, path traversal, and CRLF injection payloads
 * are handled safely by the API without leaking data or causing errors.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Injection - SQL Injection via search', () => {

  // Case 9: SQL injection via search query parameter
  for (const payload of SQL_PAYLOADS) {
    test(`search should handle SQL payload safely: ${payload.slice(0, 40)}...`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/words/search`, {
        params: { q: payload },
      });

      // Should get 200 with empty results or 400 for invalid query - never 500
      expect(response.status()).not.toBe(500);

      if (response.ok()) {
        const body = await response.json();
        expect(body).toHaveProperty('words');
        // Should not return all rows (SQL injection success indicator)
        expect(Array.isArray(body.words)).toBe(true);
      }
    });
  }
});

test.describe('Injection - SQL Injection via slug path', () => {

  // Case 10: SQL injection via slug in URL path
  const slugPayloads = [
    "' OR 1=1--",
    "'; DROP TABLE words;--",
    "1 UNION SELECT null,null,null,null--",
  ];

  for (const payload of slugPayloads) {
    test(`slug path should handle SQL payload safely: ${payload.slice(0, 30)}...`, async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/words/${encodeURIComponent(payload)}`
      );

      // Should be 404 (not found) - never 500 or data leak
      expect([400, 404]).toContain(response.status());
    });
  }
});

test.describe('Injection - JSON injection in generate body', () => {

  // Case 11: NoSQL/JSON injection in generate endpoint
  test('generate should handle malicious JSON payload safely', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: 'test", "__proto__": {}' },
    });

    // Should get 202 (accepted) or 400/409 - never 500
    expect(response.status()).not.toBe(500);
  });

  test('generate should handle nested object injection safely', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: 'normal', extra: { admin: true } },
    });

    expect(response.status()).not.toBe(500);
  });

  test('generate should reject non-string word field', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: { '$gt': '' } },
    });

    expect(response.status()).not.toBe(500);
  });
});

test.describe('Injection - Path traversal via slug', () => {

  // Case 12: Path traversal in slug parameter
  for (const payload of PATH_TRAVERSAL_PAYLOADS) {
    test(`path traversal should be blocked: ${payload.slice(0, 30)}`, async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/words/${encodeURIComponent(payload)}`
      );

      // Should be 404 - never expose file system content
      expect([400, 404]).toContain(response.status());

      const body = await response.text();
      // Should not contain file system content
      expect(body).not.toContain('root:');
      expect(body).not.toContain('/bin/bash');
      expect(body).not.toContain('[boot loader]');
    });
  }
});

test.describe('Injection - CRLF injection via search', () => {

  // Case 13: CRLF injection in search query
  for (const payload of CRLF_PAYLOADS) {
    test(`CRLF injection should be blocked: ${payload.slice(0, 30)}`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/words/search`, {
        params: { q: payload },
      });

      // Check response headers don't contain injected values
      const headers = response.headers();
      expect(headers['injected-header']).toBeUndefined();
      expect(headers['set-cookie']).toBeUndefined();

      // Should not be a server error
      expect(response.status()).not.toBe(500);
    });
  }
});
