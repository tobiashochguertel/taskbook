/**
 * E2E tests — Health endpoint
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { loadE2EConfig, type E2EConfig } from "./setup";

let config: E2EConfig | null;

beforeAll(() => {
  config = loadE2EConfig();
});

describe("Health endpoint", () => {
  test("GET /health returns 200 with server info", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/health`);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.status).toBe("ok");
    expect(body.server).toBe("taskbook-mcp");
    expect(body.version).toBeTruthy();
  });

  test("GET /health reports OAuth status", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/health`);
    const body = await resp.json();
    expect(["enabled", "disabled"]).toContain(body.oauth);
  });
});
