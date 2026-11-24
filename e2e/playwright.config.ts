import { defineConfig, devices } from "@playwright/test";
import { API_ORIGIN, WEB_ORIGIN, WEB_PORT, backendEnvironment, webEnvironment } from "./support/environment.ts";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      use: { baseURL: API_ORIGIN },
    },
    {
      name: "ui",
      testDir: "./tests/ui",
      use: { ...devices["Desktop Chrome"], baseURL: WEB_ORIGIN, viewport: { width: 1400, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "node scripts/start-backend.ts",
      url: `${API_ORIGIN}/api/health`,
      env: backendEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter web exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB_ORIGIN,
      env: webEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
