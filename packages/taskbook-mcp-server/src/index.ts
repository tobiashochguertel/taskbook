#!/usr/bin/env bun
/**
 * Taskbook MCP Server — Model Context Protocol server for Taskbook
 *
 * Exposes task management tools (create, complete, delete, search, etc.)
 * and resources (boards, items, archive) to LLM clients via MCP.
 *
 * Transports:
 *   stdio — single client, reads config from ~/.taskbook.json
 *   http  — multi-client with session management, Streamable HTTP
 *
 * Usage:
 *   bun run src/index.ts                    # stdio (default)
 *   TB_MCP_TRANSPORT=http bun run src/index.ts  # HTTP on port 3100
 *   TB_MCP_TRANSPORT=http TB_MCP_PORT=8080 bun run src/index.ts
 */

import { startStdioTransport } from "./transport/stdio.js";
import { startHttpTransport } from "./transport/http.js";
import { loadMcpConfig } from "./config.js";

async function main() {
  const args = process.argv.slice(2);

  // CLI argument override: --transport=http|stdio
  let transportOverride: string | undefined;
  for (const arg of args) {
    if (arg.startsWith("--transport=")) {
      transportOverride = arg.split("=")[1];
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Taskbook MCP Server

Usage:
  taskbook-mcp [--transport=stdio|http] [--port=PORT] [--host=HOST]

Environment variables:
  TB_MCP_TRANSPORT          Transport type: stdio (default) or http
  TB_MCP_PORT               HTTP port (default: 3100)
  TB_MCP_HOST               HTTP bind address (default: 127.0.0.1)
  TB_MCP_ACCESS_TOKEN       Optional: static token for HTTP auth (legacy)
  TB_SERVER_URL             Taskbook server URL (overrides ~/.taskbook.json)
  TB_TOKEN                  Taskbook session token (overrides ~/.taskbook.json)
  TB_ENCRYPTION_KEY         Encryption key (overrides ~/.taskbook.json)
  TB_CONFIG_PATH            Path to taskbook config (default: ~/.taskbook.json)

OAuth environment variables (all required to enable OAuth):
  TB_MCP_PUBLIC_URL         Public URL of this MCP server
  TB_MCP_OAUTH_ISSUER       Authelia/OIDC issuer URL
  TB_MCP_OAUTH_CLIENT_ID    OAuth client ID registered at issuer
  TB_MCP_OAUTH_CLIENT_SECRET OAuth client secret
`);
      process.exit(0);
    }
  }

  if (transportOverride) {
    process.env.TB_MCP_TRANSPORT = transportOverride;
  }
  for (const arg of args) {
    if (arg.startsWith("--port=")) {
      process.env.TB_MCP_PORT = arg.split("=")[1];
    }
    if (arg.startsWith("--host=")) {
      process.env.TB_MCP_HOST = arg.split("=")[1];
    }
  }

  const config = loadMcpConfig();

  if (config.transport === "http") {
    await startHttpTransport(config);
  } else {
    await startStdioTransport();
  }
}

main().catch((err) => {
  console.error("[taskbook-mcp] Fatal error:", err.message ?? err);
  process.exit(1);
});
