import { defineConfig, devices } from '@playwright/test';

// En local se usa el Chrome instalado; en CI, el Chromium que descarga Playwright.
const chrome = { channel: process.env.CI ? undefined : 'chrome', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } };

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5175' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1280, height: 800 } } },
    { name: 'movil', use: { ...devices['Pixel 7'], ...chrome } },
  ],
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
