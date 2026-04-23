import { test, expect } from '@playwright/test';
import { createWord, safeDelete } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';
const DELETE_SLUG = 'e2e-delete-word';

test.describe('Delete Word', () => {
  test.beforeEach(async ({ request }) => {
    await createWord(request, {
      slug: DELETE_SLUG,
      title: 'DeleteMe',
      subtitle: 'Word to be deleted',
      phonetic: '/dɪˈliːt/',
      sections: JSON.stringify([{
        title: 'Definition',
        icon: '📖',
        content: '<p>A word created to test deletion.</p>',
      }]),
    });
  });

  test.afterEach(async ({ request }) => {
    await safeDelete(request, DELETE_SLUG);
  });

  test('should delete a word from the list', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Find the row with our test word
    const row = page.locator('table tbody tr', { hasText: 'DeleteMe' });
    await expect(row).toBeVisible({ timeout: 5000 });

    // Click delete button
    const deleteButton = row.locator('button[title="Delete"]').or(row.locator('button').filter({ hasText: /delete/i })).first();

    // Listen for the DELETE API call
    const deletePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/words/${DELETE_SLUG}`) && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    await deleteButton.click();

    // Handle confirmation dialog if present
    const confirmButton = page.locator('.ant-popconfirm-buttons button:has-text("OK")')
      .or(page.locator('.ant-modal button:has-text("OK")'))
      .or(page.locator('button:has-text("Yes")'));
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.first().click();
    }

    const response = await deletePromise;
    expect(response.status()).toBe(200);

    // Verify the word is removed from the list
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody tr', { hasText: 'DeleteMe' })).toHaveCount(0, { timeout: 5000 });
  });
});
