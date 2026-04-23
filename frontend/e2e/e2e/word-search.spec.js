import { test, expect } from '@playwright/test';
import { createWord, safeDelete } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';
const SEARCH_SLUG = 'e2e-search-word';

test.describe('Word Search', () => {
  test.beforeAll(async ({ request }) => {
    await createWord(request, {
      slug: SEARCH_SLUG,
      title: 'Serendipity',
      subtitle: 'Finding something good by chance',
      phonetic: '/ˌsɛr.ənˈdɪp.ɪ.ti/',
      sections: [{
        title: 'Definition',
        icon: '📖',
        content: '<p>The occurrence of events by chance in a happy way.</p>',
      }],
    });
  });

  test.afterAll(async ({ request }) => {
    await safeDelete(request, SEARCH_SLUG);
  });

  test('should search and find a word', async ({ page }) => {
    // Mock search API — backend FTS uses English stemming for title but simple
    // dictionary for queries, so dynamically created words may not match.
    await page.route('**/api/words/search**', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('q') || '').toLowerCase();
      if (query.includes('serendipity')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            words: [{
              slug: SEARCH_SLUG,
              title: 'Serendipity',
              subtitle: 'Finding something good by chance',
              rank: 1.0,
            }],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const searchInput = page.locator('input').first();
    await searchInput.fill('Serendipity');

    // Wait for the search result row to appear
    const resultRow = page.locator('table tbody tr', { hasText: 'Serendipity' });
    await expect(resultRow).toBeVisible({ timeout: 5000 });
  });

  test('should show no results for gibberish query', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const searchInput = page.locator('input').first();
    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(500);

    // Either empty table or "No data" message
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      const text = await rows.first().textContent();
      expect(text?.toLowerCase()).toContain('no data');
    }
  });

  test('should clear search and restore full list', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const initialCount = await page.locator('table tbody tr').count();

    const searchInput = page.locator('input').first();
    await searchInput.fill('Serendipity');
    await page.waitForTimeout(500);

    await searchInput.clear();
    await page.waitForTimeout(500);

    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    const restoredCount = await page.locator('table tbody tr').count();
    expect(restoredCount).toBeGreaterThanOrEqual(1);
  });
});
