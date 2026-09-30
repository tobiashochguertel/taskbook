import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-browser",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL:
      process.env.TB_MCP_URL || "https://mcp-taskbook.hochguertel.work",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
