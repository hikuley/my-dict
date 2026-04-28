// @ts-check
import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Authentication E2E', () => {
  const testUser = {
    name: 'E2E Test User',
    email: `e2e-${Date.now()}@test.com`,
    password: 'TestPassword123',
  };

  test.describe('Sign Up Flow', () => {
    test('should show auth page when not logged in', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Welcome back!')).toBeVisible();
    });

    test('should switch between login and signup modes', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Welcome back!')).toBeVisible();
      await page.getByText('Sign Up').click();
      await expect(page.getByText('Create an account')).toBeVisible();
      await page.getByText('Log In').last().click();
      await expect(page.getByText('Welcome back!')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Sign Up').click();
      await page.getByRole('button', { name: 'Sign Up' }).click();
      await expect(page.getByText('Please enter your name')).toBeVisible();
    });

    test('should show error for invalid email', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Sign Up').click();
      await page.getByPlaceholder('Full Name').fill('Test User');
      await page.getByPlaceholder('Email').fill('not-an-email');
      await page.getByPlaceholder('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign Up' }).click();
      await expect(page.getByText('Please enter a valid email')).toBeVisible();
    });

    test('should show error for short password', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Sign Up').click();
      await page.getByPlaceholder('Full Name').fill('Test User');
      await page.getByPlaceholder('Email').fill('test@example.com');
      await page.getByPlaceholder('Password').fill('short');
      await page.getByRole('button', { name: 'Sign Up' }).click();
      await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('should show error for wrong credentials', async ({ page }) => {
      await page.goto('/');

      // Intercept the API call to return an error
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid email or password' }),
        });
      });

      await page.getByPlaceholder('Email').fill('wrong@test.com');
      await page.getByPlaceholder('Password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Log In' }).click();

      await expect(page.getByText('Invalid email or password')).toBeVisible();
    });

    test('should navigate to word list after successful login', async ({ page }) => {
      await page.goto('/');

      // Mock successful login
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-jwt-token',
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              name: 'Test User',
              email: 'test@example.com',
              authType: 'manual',
              isVerified: true,
            },
          }),
        });
      });

      // Mock the words API so the page loads
      await page.route('**/api/words?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
        });
      });

      await page.getByPlaceholder('Email').fill('test@example.com');
      await page.getByPlaceholder('Password').fill('password123');
      await page.getByRole('button', { name: 'Log In' }).click();

      await expect(page.getByText('My Dictionary')).toBeVisible();
    });
  });

  test.describe('Email Verification Flow', () => {
    test('should show verification page for unverified user after signup', async ({ page }) => {
      await page.goto('/');

      // Mock signup returning unverified user
      await page.route('**/api/auth/signup', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'mock-token',
            user: {
              id: '00000000-0000-0000-0000-000000000002',
              name: 'New User',
              email: 'new@test.com',
              authType: 'manual',
              isVerified: false,
            },
          }),
        });
      });

      await page.getByText('Sign Up').click();
      await page.getByPlaceholder('Full Name').fill('New User');
      await page.getByPlaceholder('Email').fill('new@test.com');
      await page.getByPlaceholder('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign Up' }).click();

      await expect(page.getByText('Verify Your Email')).toBeVisible();
      await expect(page.getByText('new@test.com')).toBeVisible();
    });

    test('should allow resending verification code', async ({ page }) => {
      // Set unverified user in local storage
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('user', JSON.stringify({
          id: '00000000-0000-0000-0000-000000000003',
          name: 'Unverified',
          email: 'unverified@test.com',
          authType: 'manual',
          isVerified: false,
        }));
      });
      await page.reload();

      await page.route('**/api/auth/resend-verification', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Verification code sent' }),
        });
      });

      await expect(page.getByText('Verify Your Email')).toBeVisible();
      await page.getByText("Didn't receive a code? Resend").click();
      await expect(page.getByText('Code resent!')).toBeVisible();
    });
  });

  test.describe('Google OAuth Flow', () => {
    test('should have Google Sign-In section', async ({ page }) => {
      await page.goto('/');
      // The "or" divider before the Google button should always be visible
      await expect(page.getByText('or')).toBeVisible();
    });

    test('should navigate to word list after successful Google auth', async ({ page }) => {
      await page.goto('/');

      // Mock Google auth endpoint
      await page.route('**/api/auth/google', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'google-jwt-token',
            user: {
              id: '00000000-0000-0000-0000-000000000004',
              name: 'Google User',
              email: 'google@test.com',
              authType: 'google',
              isVerified: true,
            },
          }),
        });
      });

      // Mock words API
      await page.route('**/api/words?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
        });
      });

      // Simulate Google auth by directly calling the store
      await page.evaluate(() => {
        localStorage.setItem('token', 'google-jwt-token');
        localStorage.setItem('user', JSON.stringify({
          id: '00000000-0000-0000-0000-000000000004',
          name: 'Google User',
          email: 'google@test.com',
          authType: 'google',
          isVerified: true,
        }));
      });
      await page.reload();

      await expect(page.getByText('My Dictionary')).toBeVisible();
      await expect(page.getByText('Google User')).toBeVisible();
    });
  });

  test.describe('Apple OAuth Flow', () => {
    test('should have Apple Sign-In button', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Continue with Apple')).toBeVisible();
    });

    test('should navigate to word list after successful Apple auth', async ({ page }) => {
      await page.goto('/');

      // Mock Apple auth endpoint
      await page.route('**/api/auth/apple', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: 'apple-jwt-token',
            user: {
              id: '00000000-0000-0000-0000-000000000010',
              name: 'Apple User',
              email: 'apple@test.com',
              authType: 'apple',
              isVerified: true,
            },
          }),
        });
      });

      // Mock words API
      await page.route('**/api/words?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
        });
      });

      // Simulate Apple auth by directly setting localStorage
      await page.evaluate(() => {
        localStorage.setItem('token', 'apple-jwt-token');
        localStorage.setItem('user', JSON.stringify({
          id: '00000000-0000-0000-0000-000000000010',
          name: 'Apple User',
          email: 'apple@test.com',
          authType: 'apple',
          isVerified: true,
        }));
      });
      await page.reload();

      await expect(page.getByText('My Dictionary')).toBeVisible();
      await expect(page.getByText('Apple User')).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('should return to auth page after logout', async ({ page }) => {
      await page.goto('/');

      // Mock words API before setting auth state
      await page.route('**/api/words?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
        });
      });

      // Set authenticated user
      await page.evaluate(() => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', JSON.stringify({
          id: '00000000-0000-0000-0000-000000000005',
          name: 'Logout User',
          email: 'logout@test.com',
          authType: 'manual',
          isVerified: true,
        }));
      });

      await page.reload();
      await expect(page.getByText('My Dictionary')).toBeVisible();

      // Click logout
      await page.getByTitle('Log out').click();

      await expect(page.getByText('Welcome back!')).toBeVisible();

      // Verify localStorage is cleared
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    });
  });

  test.describe('Profile Button', () => {
    test('should show profile button when logged in', async ({ page }) => {
      await page.goto('/');

      await page.evaluate(() => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', JSON.stringify({
          id: '00000000-0000-0000-0000-000000000006',
          name: 'Profile Test User',
          email: 'profile@test.com',
          authType: 'manual',
          isVerified: true,
        }));
      });

      await page.route('**/api/words?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
        });
      });

      await page.reload();
      await expect(page.getByText('My Dictionary')).toBeVisible();
      await expect(page.locator('button[title="Profile"]')).toBeVisible();
    });
  });
});
