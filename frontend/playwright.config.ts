import { defineConfig, devices } from "@playwright/test";

// Use a dedicated port for e2e tests so it doesn't conflict with `npm run dev` (port 5173).
// Set E2E_PORT when another project already listens on the default.
const E2E_PORT = Number(process.env.E2E_PORT) || 5174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}/`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx vite --port ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/`,
    reuseExistingServer: false,
  },
});
