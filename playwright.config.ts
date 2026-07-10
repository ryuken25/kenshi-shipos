import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './qa',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'https://kenshi-shipos.vercel.app',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
