import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskbookClient } from "../client/api.js";
import { loadTaskbookConfig } from "../config.js";
import { createMcpServer } from "../server.js";

/**
 * Start the MCP server with stdio transport.
 * Reads credentials from ~/.taskbook.json or environment variables.
 * Single-client: one process per MCP client connection.
 */
export async function startStdioTransport(): Promise<void> {
  const config = loadTaskbookConfig();
  const client = new TaskbookClient(config);
  const server = createMcpServer(() => client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[taskbook-mcp] stdio transport connected (server: ${config.serverUrl})\n`,
  );
}
