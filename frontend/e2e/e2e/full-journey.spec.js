import { test, expect } from '@playwright/test';
import { createWord, safeDelete } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';
const FLOW_SLUG = 'e2e-flow-word';

test.describe('Full User Journey', () => {
  test.afterAll(async ({ request }) => {
    await safeDelete(request, FLOW_SLUG);
  });

  test('complete flow: create word via API → view in list → open detail → search → delete', async ({ page, request }) => {
    // Step 1: Create a word via API (simulating data already in DB)
    const createResponse = await createWord(request, {
      slug: FLOW_SLUG,
      title: 'Ubiquitous',
      subtitle: 'Present everywhere',
      phonetic: '/juːˈbɪk.wɪ.təs/',
      sections: JSON.stringify([
        { title: 'Definition', icon: '📖', content: '<p>Present, appearing, or found everywhere.</p>' },
        { title: 'Examples', icon: '💡', content: '<p>The ubiquitous smartphone has changed modern life.</p>' },
      ]),
    });
    expect(createResponse.status()).toBe(201);

    // Step 2: Load the app and verify word appears in list
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const row = page.locator('table tbody tr', { hasText: 'Ubiquitous' });
    await expect(row).toBeVisible({ timeout: 5000 });

    // Step 3: Open detail modal and verify full content
    await row.locator('button[title="Detail"]').or(row.locator('button').filter({ hasText: /detail/i })).first().click();
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    const modal = page.locator('.ant-modal');
    await expect(modal).toContainText('Ubiquitous');
    await expect(modal).toContainText('/juːˈbɪk.wɪ.təs/');

    // Close modal
    await page.locator('.ant-modal .ant-modal-close').first().click();
    await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 5000 });

    // Step 4: Search for the word
    const searchInput = page.locator('input').first();
    await searchInput.fill('Ubiquitous');
    await page.waitForTimeout(500);
    const searchRow = page.locator('table tbody tr', { hasText: 'Ubiquitous' });
    await expect(searchRow).toBeVisible({ timeout: 5000 });

    // Step 5: Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Step 6: Delete the word
    const deleteRow = page.locator('table tbody tr', { hasText: 'Ubiquitous' });
    await expect(deleteRow).toBeVisible({ timeout: 5000 });

    const deleteButton = deleteRow.locator('button[title="Delete"]').or(deleteRow.locator('button').filter({ hasText: /delete/i })).first();

    const deletePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/words/${FLOW_SLUG}`) && response.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    await deleteButton.click();

    // Handle confirmation if present
    const confirmButton = page.locator('.ant-popconfirm-buttons button:has-text("OK")')
      .or(page.locator('.ant-modal button:has-text("OK")'))
      .or(page.locator('button:has-text("Yes")'));
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.first().click();
    }

    await deletePromise;

    // Verify word is gone
    await page.waitForTimeout(1000);
    await expect(page.locator('table tbody tr', { hasText: 'Ubiquitous' })).toHaveCount(0, { timeout: 5000 });
  });
});
