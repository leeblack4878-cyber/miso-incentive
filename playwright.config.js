import { defineConfig } from '@playwright/test';
import { readEnvironment } from './tests/e2e/environment.js';
// --list works without credentials; execution performs strict preflight in fixtures.
const configured = process.env.E2E_SUPABASE_URL ? readEnvironment() : null;
export default defineConfig({
  globalSetup: './tests/e2e/preflight.js',
  testDir: './tests/e2e', testMatch: '**/*.spec.js', fullyParallel: false, workers: 1,
  retries: 0, timeout: 90000, expect: { timeout: 15000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4179', browserName: 'chromium',
    viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block', trace: 'off', screenshot: 'only-on-failure', video: 'off' },
  webServer: configured ? {
    command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: configured.url, VITE_SUPABASE_PUBLISHABLE_KEY: configured.publicKey },
  } : undefined,
});
