import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { TaskbookClient } from "../client/api.js";

export function registerResources(
  server: McpServer,
  getClient: () => TaskbookClient,
) {
  // Static resource: server status
  server.resource(
    "status",
    "taskbook://status",
    { description: "Taskbook server status and user info", mimeType: "application/json" },
    async (uri): Promise<ReadResourceResult> => {
      const client = getClient();
      const [health, me] = await Promise.all([client.health(), client.me()]);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ health, user: me }, null, 2),
          },
        ],
      };
    },
  );

  // Dynamic resource: board contents
  server.resource(
    "board",
    new ResourceTemplate("taskbook://boards/{boardName}", {
      list: async () => {
        const boards = await getClient().listBoards();
        return {
          resources: boards.map((b) => ({
            uri: `taskbook://boards/${encodeURIComponent(b)}`,
            name: `@${b}`,
            description: `Tasks and notes on board @${b}`,
          })),
        };
      },
    }),
    { description: "Tasks and notes on a specific board", mimeType: "application/json" },
    async (uri, { boardName }): Promise<ReadResourceResult> => {
      const board = decodeURIComponent(boardName as string);
      const client = getClient();
      const [tasks, notes] = await Promise.all([
        client.listTasks(board),
        client.listNotes(board),
      ]);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ board, tasks, notes }, null, 2),
          },
        ],
      };
    },
  );

  // Static resource: all items (overview)
  server.resource(
    "all-items",
    "taskbook://items",
    { description: "All tasks and notes across all boards", mimeType: "application/json" },
    async (uri): Promise<ReadResourceResult> => {
      const items = await getClient().getItems();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(Object.values(items), null, 2),
          },
        ],
      };
    },
  );

  // Static resource: archive
  server.resource(
    "archive",
    "taskbook://archive",
    { description: "Archived tasks and notes", mimeType: "application/json" },
    async (uri): Promise<ReadResourceResult> => {
      const archive = await getClient().getArchive();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(Object.values(archive), null, 2),
          },
        ],
      };
    },
  );
}
