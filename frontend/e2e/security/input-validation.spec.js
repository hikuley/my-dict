// @ts-check
import { test, expect } from '@playwright/test';
import { authHeaders } from '../fixtures/api-helpers.js';

/**
 * Input Validation & Boundary Penetration Tests (Cases 19-25)
 *
 * Tests boundary conditions and malformed input handling.
 */

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Input Validation - Generate endpoint', () => {

  // Case 19: Oversized word input
  test('should reject or truncate oversized word input (10000+ chars)', async ({ request }) => {
    const headers = await authHeaders(request);
    const longWord = 'a'.repeat(10000);
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: longWord },
      headers,
    });

    // Should not be a server error
    expect(response.status()).not.toBe(500);

    if (response.status() === 202) {
      const body = await response.json();
      // Backend should truncate to 100 chars
      expect(body.word.length).toBeLessThanOrEqual(100);
    }
  });

  // Case 20: Empty/whitespace-only word
  test('should reject empty word', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: '' },
      headers,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should reject whitespace-only word', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: '   ' },
      headers,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // Case 21: Special Unicode characters
  test('should handle zero-width characters safely', async ({ request }) => {
    const headers = await authHeaders(request);
    const zeroWidthWord = 'test\u200B\u200C\u200Dword';
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: zeroWidthWord },
      headers,
    });

    expect(response.status()).not.toBe(500);
  });

  test('should handle RTL override characters safely', async ({ request }) => {
    const headers = await authHeaders(request);
    const rtlWord = 'test\u202Eword\u202C';
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: rtlWord },
      headers,
    });

    expect(response.status()).not.toBe(500);
  });

  test('should handle emoji in word', async ({ request }) => {
    const headers = await authHeaders(request);
    const emojiWord = '🔥fire🔥';
    const response = await request.post(`${API_URL}/api/words/generate`, {
      data: { word: emojiWord },
      headers,
    });

    expect(response.status()).not.toBe(500);
  });
});

test.describe('Input Validation - Search endpoint', () => {

  // Case 22: Extremely long search query
  test('should handle extremely long search query (10000+ chars)', async ({ request }) => {
    const headers = await authHeaders(request);
    const longQuery = 'a'.repeat(10000);
    const response = await request.get(`${API_URL}/api/words/search`, {
      params: { q: longQuery },
      headers,
    });

    // Should not crash the server
    expect(response.status()).not.toBe(500);
  });

  test('should handle search with null bytes', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words/search`, {
      params: { q: 'test\x00word' },
      headers,
    });

    expect(response.status()).not.toBe(500);
  });
});

test.describe('Input Validation - Pagination', () => {

  // Case 23: Negative pagination values
  test('should handle negative page number', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: -1, limit: 20 },
      headers,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Backend should coerce to minimum valid page
    expect(body.page).toBeGreaterThanOrEqual(1);
  });

  test('should handle negative limit', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 1, limit: -1 },
      headers,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.limit).toBeGreaterThanOrEqual(1);
  });

  // Case 24: Zero pagination
  test('should handle zero page', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 0, limit: 20 },
      headers,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.page).toBeGreaterThanOrEqual(1);
  });

  test('should handle zero limit', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 1, limit: 0 },
      headers,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.limit).toBeGreaterThanOrEqual(1);
  });

  // Case 25: Non-numeric pagination
  test('should handle non-numeric page', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 'abc', limit: 20 },
      headers,
    });

    // Should not crash - either 200 with defaults or 400
    expect(response.status()).not.toBe(500);
  });

  test('should handle non-numeric limit', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 1, limit: 'xyz' },
      headers,
    });

    expect(response.status()).not.toBe(500);
  });

  test('should cap limit at reasonable maximum', async ({ request }) => {
    const headers = await authHeaders(request);
    const response = await request.get(`${API_URL}/api/words`, {
      params: { page: 1, limit: 999999 },
      headers,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Backend should cap at 100
    expect(body.limit).toBeLessThanOrEqual(100);
  });
});
