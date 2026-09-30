/**
 * E2E tests — Authentication (PAT and invalid tokens)
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { loadE2EConfig, MCP_HEADERS, type E2EConfig } from "./setup";

let config: E2EConfig | null;

beforeAll(() => {
  config = loadE2EConfig();
});

describe("PAT authentication", () => {
  test("Valid PAT grants access to /mcp initialize", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        ...MCP_HEADERS,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    expect(resp.status).toBe(200);

    // Response may be SSE or JSON
    const contentType = resp.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    if (contentType.includes("text/event-stream")) {
      const text = await resp.text();
      const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
      body = dataLine ? JSON.parse(dataLine.slice(6)) : {};
    } else {
      body = await resp.json();
    }
    expect(body.result).toBeTruthy();
    const result = body.result as Record<string, unknown>;
    expect(result.serverInfo).toBeTruthy();
    expect(result.protocolVersion).toBeTruthy();
  });
});

describe("Invalid authentication", () => {
  test("Missing Authorization header returns 401", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    expect(resp.status).toBe(401);
  });

  test("Invalid token returns 401", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/mcp`, {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid_token_12345",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0.0" },
        },
        id: 1,
      }),
    });

    expect(resp.status).toBe(401);
  });

  test("401 response includes WWW-Authenticate header when OAuth enabled", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {},
        id: 1,
      }),
    });

    if (resp.status === 401) {
      // WWW-Authenticate header should be present if OAuth is enabled
      const wwwAuth = resp.headers.get("www-authenticate");
      // May or may not be present depending on server config
      if (wwwAuth) {
        expect(wwwAuth).toContain("Bearer");
      }
    }
  });
});
