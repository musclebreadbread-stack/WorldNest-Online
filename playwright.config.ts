import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

/**
 * Playwright configuration for the smoke suite.
 *
 * These specs run against a production build (`next start`), which is what makes
 * them worth having: they exercise the real middleware and the real client
 * bundle, the two things the jsdom unit tests cannot reach. They are kept out of
 * `turbo run test` so `pnpm test` stays fast and browser-free.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter @worldnest/web start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
