import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { TaskbookClient } from "../client/api.js";
import { loadTaskbookConfig } from "../config.js";
import { createMcpServer, SERVER_NAME, SERVER_VERSION } from "../server.js";
import {
  loadOAuthConfig,
  discoverOidcEndpoints,
  type OAuthEndpoints,
} from "../auth/config.js";
import { OAuthRouter } from "../auth/routes.js";
import { verifyToken } from "../auth/token-verifier.js";
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
 * Authentication:
 *  - PAT: Bearer tb_* tokens validated against the taskbook server
 *  - OAuth: Access tokens validated via Authelia introspection
 *  - Legacy: TB_MCP_ACCESS_TOKEN env var for backward compatibility
 */
export async function startHttpTransport(config: HttpConfig): Promise<void> {
  const sessions = new Map<string, SessionInfo>();
  const { port, host } = config;

  // Legacy static token (backward compat)
  const legacyToken = process.env.TB_MCP_ACCESS_TOKEN;

  // OAuth setup
  const oauthConfig = loadOAuthConfig();
  let oauthEndpoints: OAuthEndpoints | null = null;
  let oauthRouter: OAuthRouter | null = null;

  if (oauthConfig) {
    try {
      oauthEndpoints = await discoverOidcEndpoints(oauthConfig.issuerUrl);
      oauthRouter = new OAuthRouter(oauthConfig, oauthEndpoints);
      console.log(
        `[taskbook-mcp] OAuth enabled — issuer: ${oauthConfig.issuerUrl}`,
      );
    } catch (err) {
      console.warn(
        `[taskbook-mcp] OAuth setup failed (falling back to token-only auth): ${err}`,
      );
    }
  }

  // Load taskbook server URL for PAT verification
  let taskbookServerUrl = process.env.TB_SERVER_URL ?? "";
  if (!taskbookServerUrl) {
    try {
      const tbConfig = loadTaskbookConfig();
      taskbookServerUrl = tbConfig.serverUrl;
    } catch {
      // Will be loaded per-session
    }
  }

  async function verifyAuth(req: Request): Promise<boolean> {
    // Legacy static token check
    if (legacyToken) {
      const auth = req.headers.get("authorization");
      if (auth) {
        const [scheme, token] = auth.split(" ", 2);
        if (scheme?.toLowerCase() === "bearer" && token === legacyToken) {
          return true;
        }
      }
    }

    // Dynamic token verification (PAT or OAuth)
    const auth = req.headers.get("authorization");
    if (!auth) {
      // If no auth required (legacy mode with no token configured)
      return !legacyToken && !oauthConfig;
    }

    const [scheme, token] = auth.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || !token) return false;

    const authInfo = await verifyToken(
      token,
      taskbookServerUrl,
      oauthConfig,
      oauthEndpoints,
    );
    return authInfo !== null;
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

  function unauthorizedResponse(): Response {
    const headers: Record<string, string> = {
      ...corsHeaders(),
    };

    // Include WWW-Authenticate with OAuth metadata URL if OAuth is configured
    if (oauthConfig) {
      headers["WWW-Authenticate"] =
        `Bearer resource_metadata="${oauthConfig.publicUrl}/.well-known/oauth-protected-resource"`;
    }

    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      },
      { status: 401, headers },
    );
  }

  Bun.serve({
    port,
    hostname: host,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);

      // Health check (no auth required)
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          server: SERVER_NAME,
          version: SERVER_VERSION,
          oauth: oauthConfig ? "enabled" : "disabled",
        });
      }

      // OAuth routes (no auth required — they implement their own auth)
      if (oauthRouter) {
        const oauthResponse = await oauthRouter.handleRequest(req);
        if (oauthResponse) return oauthResponse;
      }

      // CORS preflight for MCP endpoint
      if (url.pathname === "/mcp" && req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // All other routes require the /mcp path
      if (url.pathname !== "/mcp") {
        return new Response("Not Found", { status: 404 });
      }

      // Authentication check
      if (!(await verifyAuth(req))) {
        return unauthorizedResponse();
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
  if (oauthConfig) {
    console.log(
      `[taskbook-mcp] OAuth metadata: http://${host}:${port}/.well-known/oauth-authorization-server`,
    );
  }
}
