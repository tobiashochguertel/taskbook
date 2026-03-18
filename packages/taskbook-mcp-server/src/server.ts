import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskbookClient } from "./client/api.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerBoardTools } from "./tools/boards.js";
import { registerGeneralTools } from "./tools/general.js";
import { registerResources } from "./resources/index.js";

export const SERVER_NAME = "taskbook-mcp";
export const SERVER_VERSION = "1.0.0";

/**
 * Create a fully configured MCP server with all tools and resources.
 * The `getClient` callback is called per-request so that different
 * transports can provide per-session TaskbookClient instances.
 */
export function createMcpServer(
  getClient: () => TaskbookClient,
): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  registerTaskTools(server, getClient);
  registerNoteTools(server, getClient);
  registerBoardTools(server, getClient);
  registerGeneralTools(server, getClient);
  registerResources(server, getClient);

  return server;
}
