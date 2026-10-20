import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the public build and its built-in sample trip, at phone size.
 * Never the private build: that carries booking references and documents.
 *
 * Every test gets a fresh browser context, so a fresh IndexedDB and the sample trip.
 */
const PORT = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // A cold first launch loads the sample trip into storage, which WebKit on Windows is
  // slow at under parallel load. Generous limits, so slowness is not reported as failure.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['line']],
  use: {
    baseURL: `http://localhost:${PORT}/shipshape/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'phone-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    // The production build, not the dev server: it is what ships, and the dev server's
    // hundreds of unbundled modules make a cold start in WebKit take ~20 s.
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/shipshape/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
