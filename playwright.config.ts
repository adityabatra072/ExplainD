import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  retries: 0,
  workers: 1, // lessons share the sqlite db; keep runs serial
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
