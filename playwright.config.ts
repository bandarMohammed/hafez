import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the production build (`next build` + `next start`) on port 3100.
 * Browser: the locally installed Microsoft Edge (channel "msedge") so no browser download is needed.
 * Override with PW_CHANNEL=chrome, or PW_CHANNEL=chromium after `npx playwright install chromium`.
 */
const PORT = 3100;
const channel = process.env.PW_CHANNEL ?? "msedge";
const browser = channel === "chromium" ? {} : { channel };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...browser, viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/ar`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
