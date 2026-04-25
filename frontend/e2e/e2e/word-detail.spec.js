import { test, expect } from '@playwright/test';
import { createWord, safeDelete, authenticatePage } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';
const DETAIL_SLUG = 'e2e-detail-word';

test.describe('Word Detail', () => {
  test.beforeAll(async ({ request }) => {
    await createWord(request, {
      slug: DETAIL_SLUG,
      title: 'Ephemeral',
      subtitle: 'Lasting for a very short time',
      phonetic: '/ɪˈfɛm.ər.əl/',
      sections: [
        {
          title: 'Definition',
          icon: '📖',
          content: '<p>Lasting for a very short time.</p>',
        },
        {
          title: 'Examples',
          icon: '💡',
          content: '<p>The ephemeral beauty of cherry blossoms.</p>',
        },
      ],
    });
  });

  test.afterAll(async ({ request }) => {
    await safeDelete(request, DETAIL_SLUG);
  });

  test('should open word detail modal via Detail button', async ({ page, request }) => {
    await authenticatePage(page, request);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Find the row with our test word and click Detail
    const row = page.locator('table tbody tr', { hasText: 'Ephemeral' });
    await expect(row).toBeVisible({ timeout: 5000 });

    const detailButton = row.locator('button[title="Detail"]').or(row.locator('button').filter({ hasText: /detail/i })).first();
    await detailButton.click();

    // Wait for modal to appear
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    // Verify modal content
    const modalContent = await page.locator('.ant-modal').textContent();
    expect(modalContent).toContain('Ephemeral');
    expect(modalContent).toContain('/ɪˈfɛm.ər.əl/');
  });

  test('should open word detail modal via double-click', async ({ page, request }) => {
    await authenticatePage(page, request);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const row = page.locator('table tbody tr', { hasText: 'Ephemeral' });
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.dblclick();

    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });
    const modalContent = await page.locator('.ant-modal').textContent();
    expect(modalContent).toContain('Ephemeral');
  });

  test('should display word sections in detail modal', async ({ page, request }) => {
    await authenticatePage(page, request);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const row = page.locator('table tbody tr', { hasText: 'Ephemeral' });
    await row.locator('button[title="Detail"]').or(row.locator('button').filter({ hasText: /detail/i })).first().click();
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    // Should have collapsible sections (wait for API response and render)
    const collapseItems = page.locator('.ant-modal .ant-collapse-item');
    await expect(collapseItems.first()).toBeVisible({ timeout: 10000 });
    const count = await collapseItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should close detail modal', async ({ page, request }) => {
    await authenticatePage(page, request);
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const row = page.locator('table tbody tr', { hasText: 'Ephemeral' });
    await row.locator('button[title="Detail"]').or(row.locator('button').filter({ hasText: /detail/i })).first().click();
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    // Close the modal
    const closeButton = page.locator('.ant-modal .ant-modal-close').or(page.locator('.ant-modal button:has-text("Cancel")'));
    await closeButton.first().click();

    await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 5000 });
  });
});
