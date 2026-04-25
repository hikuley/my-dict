import { test, expect } from '@playwright/test';
import { createWord, safeDelete, authenticatePage } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';
const DELETE_SLUG = 'e2e-delete-word';

test.describe('Delete Word', () => {
  test.beforeEach(async ({ request }) => {
    await createWord(request, {
      slug: DELETE_SLUG,
      title: 'DeleteMe',
      subtitle: 'Word to be deleted',
      phonetic: '/dɪˈliːt/',
      sections: [{
        title: 'Definition',
        icon: '📖',
        content: '<p>A word created to test deletion.</p>',
      }],
    });
  });

  test.afterEach(async ({ request }) => {
    await safeDelete(request, DELETE_SLUG);
  });

  test('should delete a word from the list', async ({ page, request }) => {
    await authenticatePage(page, request);
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

    // Wait for Ant Design Modal.confirm dialog and click "Yes"
    const confirmBtn = page.locator('.ant-modal-confirm-btns button').filter({ hasText: 'Yes' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();

    const response = await deletePromise;
    expect(response.status()).toBe(200);

    // Verify the word is removed from the list
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody tr', { hasText: 'DeleteMe' })).toHaveCount(0, { timeout: 5000 });
  });
});
