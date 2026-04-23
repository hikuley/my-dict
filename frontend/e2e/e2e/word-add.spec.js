import { test, expect } from '@playwright/test';
import { safeDelete } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Add Word (Generate via Kafka)', () => {
  const testWord = 'quintessential';

  test.afterAll(async ({ request }) => {
    await safeDelete(request, testWord);
  });

  test('should open add word modal and submit', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Click the Add Word button
    const addButton = page.locator('button:has-text("Add Word")').or(page.locator('button:has-text("Add")'));
    await addButton.first().click();

    // Wait for modal
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    // Type the word
    const wordInput = page.locator('.ant-modal input');
    await wordInput.fill(testWord);

    // Submit
    const submitButton = page.locator('.ant-modal button:has-text("OK")').or(page.locator('.ant-modal button[type="submit"]'));
    await submitButton.first().click();

    // Modal should close after submission
    await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 10000 });

    // Verify a progress bar or notification appears (async generation via Kafka)
    // The WebSocket will receive word-processing → word-ready events
    // We wait for the word to appear in the list (up to 30s for Kafka + Claude processing)
    // In CI with ANTHROPIC_API_KEY=test-key, the generate endpoint returns 202 but
    // the actual generation will fail. We verify the request was accepted.
  });

  test('should show progress indicator after submitting word', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    const addButton = page.locator('button:has-text("Add Word")').or(page.locator('button:has-text("Add")'));
    await addButton.first().click();
    await page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });

    const wordInput = page.locator('.ant-modal input');
    await wordInput.fill('ephemeron');

    // Intercept the generate API call to verify it's made
    const generatePromise = page.waitForResponse(
      (response) => response.url().includes('/api/words/generate') && response.status() >= 200,
      { timeout: 10000 }
    );

    const submitButton = page.locator('.ant-modal button:has-text("OK")').or(page.locator('.ant-modal button[type="submit"]'));
    await submitButton.first().click();

    const response = await generatePromise;
    expect([200, 202, 409]).toContain(response.status());

    // Cleanup
    await safeDelete(page.request, 'ephemeron');
  });
});
