// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Input Validation & Boundary Penetration Tests (Cases 19-25)
 *
 * Tests boundary conditions and malformed input handling.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Input Validation - Generate endpoint', () => {

  // Case 19: Oversized word input
  test('should reject or truncate oversized word input (10000+ chars)', async ({ request }) => {
    const longWord = 'a'.repeat(10000);
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: longWord },
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
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: '' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should reject whitespace-only word', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: '   ' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // Case 21: Special Unicode characters
  test('should handle zero-width characters safely', async ({ request }) => {
    const zeroWidthWord = 'test\u200B\u200C\u200Dword'; // zero-width space/joiner
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: zeroWidthWord },
    });

    expect(response.status()).not.toBe(500);
  });

  test('should handle RTL override characters safely', async ({ request }) => {
    const rtlWord = 'test\u202Eword\u202C'; // RTL override
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: rtlWord },
    });

    expect(response.status()).not.toBe(500);
  });

  test('should handle emoji in word', async ({ request }) => {
    const emojiWord = '🔥fire🔥';
    const response = await request.post(`${BASE_URL}/api/words/generate`, {
      data: { word: emojiWord },
    });

    expect(response.status()).not.toBe(500);
  });
});

test.describe('Input Validation - Search endpoint', () => {

  // Case 22: Extremely long search query
  test('should handle extremely long search query (10000+ chars)', async ({ request }) => {
    const longQuery = 'a'.repeat(10000);
    const response = await request.get(`${BASE_URL}/api/words/search`, {
      params: { q: longQuery },
    });

    // Should not crash the server
    expect(response.status()).not.toBe(500);
  });

  test('should handle search with null bytes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words/search`, {
      params: { q: 'test\x00word' },
    });

    expect(response.status()).not.toBe(500);
  });
});

test.describe('Input Validation - Pagination', () => {

  // Case 23: Negative pagination values
  test('should handle negative page number', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: -1, limit: 20 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Backend should coerce to minimum valid page
    expect(body.page).toBeGreaterThanOrEqual(1);
  });

  test('should handle negative limit', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 1, limit: -1 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.limit).toBeGreaterThanOrEqual(1);
  });

  // Case 24: Zero pagination
  test('should handle zero page', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 0, limit: 20 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.page).toBeGreaterThanOrEqual(1);
  });

  test('should handle zero limit', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 1, limit: 0 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.limit).toBeGreaterThanOrEqual(1);
  });

  // Case 25: Non-numeric pagination
  test('should handle non-numeric page', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 'abc', limit: 20 },
    });

    // Should not crash - either 200 with defaults or 400
    expect(response.status()).not.toBe(500);
  });

  test('should handle non-numeric limit', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 1, limit: 'xyz' },
    });

    expect(response.status()).not.toBe(500);
  });

  test('should cap limit at reasonable maximum', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/words`, {
      params: { page: 1, limit: 999999 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Backend should cap at 100
    expect(body.limit).toBeLessThanOrEqual(100);
  });
});
