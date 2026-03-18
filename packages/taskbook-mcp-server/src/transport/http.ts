import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { TaskbookClient } from "../client/api.js";
import { loadTaskbookConfig } from "../config.js";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "../server.js";
import type { McpServerConfig } from "../config.js";

// Accept just transport-level config
type HttpConfig = Pick<McpServerConfig, "port" | "host">;

interface SessionInfo {
  transport: WebStandardStreamableHTTPServerTransport;
  client: TaskbookClient;
}

/**
 * Start the MCP server with HTTP Streamable transport (Web Standard API).
 * Supports concurrent clients with session management.
 * Each session gets its own TaskbookClient instance.
 *
 * Authentication: Optionally validates a Bearer token via TB_MCP_ACCESS_TOKEN.
 * For OIDC, clients obtain a token from the identity provider and pass it
 * as the taskbook API token in env or config.
 */
export async function startHttpTransport(config: HttpConfig): Promise<void> {
  const sessions = new Map<string, SessionInfo>();

  const { port, host } = config;

  const requiredToken = process.env.TB_MCP_ACCESS_TOKEN;

  function verifyAuth(req: Request): boolean {
    if (!requiredToken) return true;
    const auth = req.headers.get("authorization");
    if (!auth) return false;
    const [scheme, token] = auth.split(" ", 2);
    return scheme?.toLowerCase() === "bearer" && token === requiredToken;
  }

  function corsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, mcp-session-id, MCP-Protocol-Version",
      "Access-Control-Expose-Headers": "mcp-session-id",
    };
  }

  Bun.serve({
    port,
    hostname: host,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          server: SERVER_NAME,
          version: SERVER_VERSION,
        });
      }

      if (url.pathname !== "/mcp") {
        return new Response("Not Found", { status: 404 });
      }

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (!verifyAuth(req)) {
        return Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32001, message: "Unauthorized" },
            id: null,
          },
          { status: 401, headers: corsHeaders() },
        );
      }

      if (req.method === "POST") {
        const sessionId = req.headers.get("mcp-session-id");

        // Existing session
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          return session.transport.handleRequest(req);
        }

        // New session — parse body to check for initialize request
        const body = await req.json();
        if (isInitializeRequest(body)) {
          const tbConfig = loadTaskbookConfig();
          const client = new TaskbookClient(tbConfig);

          const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, { transport, client });
              console.log(`[taskbook-mcp] HTTP session created: ${id}`);
            },
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              sessions.delete(transport.sessionId);
              console.log(
                `[taskbook-mcp] HTTP session closed: ${transport.sessionId}`,
              );
            }
          };

          const mcpServer = createMcpServer(() => client);
          await mcpServer.connect(transport);
          return transport.handleRequest(req, { parsedBody: body });
        }

        return Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32000, message: "Invalid or missing session" },
            id: null,
          },
          { status: 400, headers: corsHeaders() },
        );
      }

      if (req.method === "GET") {
        const sessionId = req.headers.get("mcp-session-id");
        if (sessionId && sessions.has(sessionId)) {
          return sessions.get(sessionId)!.transport.handleRequest(req);
        }
        return new Response("Invalid session", {
          status: 400,
          headers: corsHeaders(),
        });
      }

      if (req.method === "DELETE") {
        const sessionId = req.headers.get("mcp-session-id");
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          await session.transport.close();
          sessions.delete(sessionId);
          return new Response(null, { status: 204, headers: corsHeaders() });
        }
        return new Response("Invalid session", {
          status: 400,
          headers: corsHeaders(),
        });
      }

      return new Response("Method Not Allowed", { status: 405 });
    },
  });

  console.log(
    `[taskbook-mcp] HTTP transport listening on http://${host}:${port}/mcp`,
  );
  console.log(
    `[taskbook-mcp] Health check: http://${host}:${port}/health`,
  );
}
