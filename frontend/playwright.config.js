import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  projects: [
    {
      name: 'security',
      testDir: './e2e/security',
    },
    {
      name: 'e2e',
      testDir: './e2e/e2e',
      use: {
        browserName: 'chromium',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
      },
    },
  ],
});
