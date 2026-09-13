import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:4173/well-read/',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices.chromium,
        executablePath: '/opt/pw-browsers/chromium',
      },
    },
  ],

  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/well-read/',
    reuseExistingServer: !process.env.CI,
  },
});
