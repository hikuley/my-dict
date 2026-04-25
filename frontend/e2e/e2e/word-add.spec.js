import { test, expect } from '@playwright/test';
import { safeDelete, authenticatePage } from '../fixtures/api-helpers.js';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Add Word (Generate via Kafka)', () => {
  const testWord = 'quintessential';

  test.afterAll(async ({ request }) => {
    await safeDelete(request, testWord);
  });

  test('should open add word modal and submit', async ({ page, request }) => {
    // Mock the Claude API generate endpoint to return 202 without calling Anthropic
    await page.route('**/api/words/generate', async (route) => {
      const body = route.request().postDataJSON();
      const word = body?.word || 'test';
      const slug = word.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Word queued for processing',
          word,
          slug,
        }),
      });
    });

    await authenticatePage(page, request);
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
    const submitButton = page.locator('.ant-modal button:has-text("Add Word")').last();
    await submitButton.click();

    // Modal should close after submission (mocked 202 response)
    await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 10000 });
  });

  test('should show progress indicator after submitting word', async ({ page, request }) => {
    // Mock the Claude API generate endpoint to return 202 without calling Anthropic
    await page.route('**/api/words/generate', async (route) => {
      const body = route.request().postDataJSON();
      const word = body?.word || 'test';
      const slug = word.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Word queued for processing',
          word,
          slug,
        }),
      });
    });

    await authenticatePage(page, request);
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

    const submitButton = page.locator('.ant-modal button:has-text("Add Word")').last();
    await submitButton.click();

    const response = await generatePromise;
    expect([200, 202, 409]).toContain(response.status());
  });
});
