import { test, expect } from '@playwright/test';
import { createWord, safeDelete } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Word List - Display & Pagination', () => {
  test('should display the word list table on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should show word title and description columns', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const headerCells = page.locator('table thead th');
    await expect(headerCells).toHaveCount(3); // Word, Description, Actions
  });

  test('should show pagination info in footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Verify pagination footer shows page info (e.g., "Page 1 / 1")
    const pageInfo = page.locator('text=/Page \\d+ \\/ \\d+/');
    await expect(pageInfo).toBeVisible({ timeout: 5000 });

    // Verify total count is displayed
    const totalText = page.locator('text=/Total/');
    await expect(totalText).toBeVisible({ timeout: 5000 });
  });
});
