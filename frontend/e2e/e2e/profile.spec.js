// @ts-check
import { test, expect } from '@playwright/test';
import { authenticatePage } from '../fixtures/api-helpers.js';

test.describe('Profile Page E2E', () => {
  test('should navigate to profile page and see usage info', async ({ page, request }) => {
    await authenticatePage(page, request);

    // Mock profile API
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-0000-0000-000000000099',
            name: 'E2E API Helper',
            surname: null,
            email: 'e2e-api-helper@test.com',
            authType: 'manual',
            isVerified: true,
            usageCount: 12,
            usageLimit: 50,
            periodStart: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Click profile button
    const profileBtn = page.locator('button[title="Profile"]');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // Should see profile page
    await expect(page.getByText('API Usage')).toBeVisible();
    await expect(page.getByText('12')).toBeVisible();
    await expect(page.getByText('/ 50 requests used this month')).toBeVisible();
  });

  test('should update name on profile page', async ({ page, request }) => {
    await authenticatePage(page, request);

    let profileData = {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'E2E API Helper',
      surname: '',
      email: 'e2e-api-helper@test.com',
      authType: 'manual',
      isVerified: true,
      usageCount: 5,
      usageLimit: 50,
      periodStart: new Date().toISOString(),
    };

    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(profileData),
        });
      } else if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        profileData = { ...profileData, name: body.name, surname: body.surname };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(profileData),
        });
      } else {
        await route.continue();
      }
    });

    const profileBtn = page.locator('button[title="Profile"]');
    await profileBtn.click();

    await expect(page.getByText('Personal Information')).toBeVisible();

    // Update name
    const nameInput = page.locator('input#name, input[id*="name"]').first();
    await nameInput.clear();
    await nameInput.fill('Updated Name');

    const surnameInput = page.locator('input#surname, input[id*="surname"]').first();
    await surnameInput.clear();
    await surnameInput.fill('Updated Surname');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 5000 });
  });

  test('should show change password modal for manual auth users', async ({ page, request }) => {
    await authenticatePage(page, request);

    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Test User',
          surname: null,
          email: 'test@test.com',
          authType: 'manual',
          isVerified: true,
          usageCount: 0,
          usageLimit: 50,
          periodStart: new Date().toISOString(),
        }),
      });
    });

    const profileBtn = page.locator('button[title="Profile"]');
    await profileBtn.click();

    await expect(page.getByText('Password', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Change Password' }).click();

    // Password modal should appear
    await expect(page.getByText('Change Password').nth(1)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('should show change email modal', async ({ page, request }) => {
    await authenticatePage(page, request);

    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Test User',
          surname: null,
          email: 'test@test.com',
          authType: 'manual',
          isVerified: true,
          usageCount: 0,
          usageLimit: 50,
          periodStart: new Date().toISOString(),
        }),
      });
    });

    const profileBtn = page.locator('button[title="Profile"]');
    await profileBtn.click();

    await page.getByRole('button', { name: 'Change Email' }).click();

    // Email modal should appear with new email input
    await expect(page.getByPlaceholder('Enter new email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Verification Code' })).toBeVisible();
  });

  test('should navigate back to word list', async ({ page, request }) => {
    await authenticatePage(page, request);

    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Test User',
          surname: null,
          email: 'test@test.com',
          authType: 'manual',
          isVerified: true,
          usageCount: 0,
          usageLimit: 50,
          periodStart: new Date().toISOString(),
        }),
      });
    });

    // Mock words API for return
    await page.route('**/api/words?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
      });
    });

    const profileBtn = page.locator('button[title="Profile"]');
    await profileBtn.click();
    await expect(page.getByText('Profile').first()).toBeVisible();

    // Click back button
    await page.locator('button').filter({ has: page.locator('[class*="anticon-arrow-left"]') }).first().click();
    await expect(page.getByText('My Dictionary')).toBeVisible();
  });

  test('should hide password section for Google auth users', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: '00000000-0000-0000-0000-000000000099',
        name: 'Google User',
        email: 'google@test.com',
        authType: 'google',
        isVerified: true,
      }));
    });
    await page.reload();

    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Google User',
          surname: null,
          email: 'google@test.com',
          authType: 'google',
          isVerified: true,
          usageCount: 3,
          usageLimit: 50,
          periodStart: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/words?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
      });
    });

    const profileBtn = page.locator('button[title="Profile"]');
    await profileBtn.click();

    await expect(page.getByText('API Usage')).toBeVisible();
    await expect(page.getByText('Personal Information')).toBeVisible();
    await expect(page.getByText('Email', { exact: true })).toBeVisible();

    // Password section should NOT be visible for Google users
    const passwordCard = page.locator('.ant-card').filter({ hasText: 'Update your password' });
    await expect(passwordCard).toHaveCount(0);
  });
});
