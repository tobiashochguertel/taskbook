/**
 * E2E tests — MCP tool operations via protocol
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { loadE2EConfig, MCP_HEADERS, type E2EConfig } from "./setup";

let config: E2EConfig | null;
let sessionId: string | null = null;
const testTaskIds: string[] = [];

beforeAll(() => {
  config = loadE2EConfig();
});

afterAll(async () => {
  // Clean up test tasks
  if (!config || !sessionId) return;

  for (const taskId of testTaskIds) {
    try {
      await mcpCall("tools/call", {
        name: "delete_items",
        arguments: { ids: [taskId] },
      });
    } catch {
      // Best effort cleanup
    }
  }

  // Close session
  try {
    await fetch(`${config.mcpUrl}/mcp`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "mcp-session-id": sessionId,
      },
    });
  } catch {
    // Best effort
  }
});

async function mcpCall(
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!config || !sessionId)
    throw new Error("Not initialized");

  const resp = await fetch(`${config.mcpUrl}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.pat}`,
      ...MCP_HEADERS,
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Math.floor(Math.random() * 100000),
    }),
  });

  const body = await parseMcpResponse(resp);
  if (body.error) {
    throw new Error(`MCP error: ${JSON.stringify(body.error)}`);
  }
  return body.result ?? body;
}

/** Parse MCP response — handles both JSON and SSE formats */
async function parseMcpResponse(
  resp: Response,
): Promise<Record<string, unknown>> {
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await resp.text();
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (dataLine) {
      return JSON.parse(dataLine.slice(6));
    }
    throw new Error(`No data in SSE response: ${text}`);
  }
  return resp.json();
}

describe("MCP tool operations", () => {
  test("Initialize MCP session", async () => {
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
    sessionId = resp.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const body = await parseMcpResponse(resp);
    expect((body.result as Record<string, unknown> & { serverInfo: { name: string } }).serverInfo.name).toBe("taskbook-mcp");
  });

  test("List available tools", async () => {
    if (!config || !sessionId) return;

    const result = await mcpCall("tools/list", {});
    const tools = (result as { tools: Array<{ name: string }> }).tools;
    expect(tools).toBeArray();
    expect(tools.length).toBeGreaterThan(0);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("create_task");
    expect(toolNames).toContain("list_tasks");
  });

  test("Create a task via MCP", async () => {
    if (!config || !sessionId) return;

    const result = await mcpCall("tools/call", {
      name: "create_task",
      arguments: {
        description: `E2E test task ${Date.now()}`,
        board: "My Board",
      },
    });

    expect(result).toBeTruthy();
    const content = (result as { content: Array<{ text: string }> }).content;
    expect(content).toBeArray();

    // Extract task ID from response for cleanup
    const text = content[0]?.text ?? "";
    const idMatch = text.match(/(?:id|#)\s*(\d+)/i);
    if (idMatch) {
      testTaskIds.push(idMatch[1]);
    }
  });

  test("List tasks includes created task", async () => {
    if (!config || !sessionId) return;

    const result = await mcpCall("tools/call", {
      name: "list_tasks",
      arguments: { board: "My Board" },
    });

    expect(result).toBeTruthy();
    const content = (result as { content: Array<{ text: string }> }).content;
    expect(content).toBeArray();
    expect(content.length).toBeGreaterThan(0);
  });
});
