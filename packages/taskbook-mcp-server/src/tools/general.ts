import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskbookClient } from "../client/api.js";

export function registerGeneralTools(
  server: McpServer,
  getClient: () => TaskbookClient,
) {
  server.tool(
    "search_items",
    "Search tasks and notes by description, tag, or board name",
    {
      query: z.string().describe("Search query text"),
    },
    async ({ query }) => {
      const results = await getClient().searchItems(query);
      if (results.length === 0) {
        return {
          content: [
            { type: "text", text: `No items matching "${query}".` },
          ],
        };
      }
      const lines = results.map((item) => {
        const type = item._isTask ? (item.isComplete ? "✔" : "☐") : "📝";
        return `${type} ${item._id}. ${item.description}  (@${item.boards.join(", @")})`;
      });
      return {
        content: [
          {
            type: "text",
            text: [`**Search results for "${query}"** (${results.length})`, "", ...lines].join("\n"),
          },
        ],
      };
    },
  );

  server.tool(
    "edit_item",
    "Edit an item's description",
    {
      item_id: z.number().describe("The item ID to edit"),
      description: z.string().describe("New description text"),
    },
    async ({ item_id, description }) => {
      const item = await getClient().editItem(item_id, description);
      return {
        content: [
          {
            type: "text",
            text: `Updated item #${item._id}: ${item.description}`,
          },
        ],
      };
    },
  );

  server.tool(
    "delete_item",
    "Permanently delete a task or note",
    {
      item_id: z.number().describe("The item ID to delete"),
    },
    async ({ item_id }) => {
      await getClient().deleteItem(item_id);
      return {
        content: [{ type: "text", text: `Deleted item #${item_id}` }],
      };
    },
  );

  server.tool(
    "archive_item",
    "Move an item to the archive",
    {
      item_id: z.number().describe("The item ID to archive"),
    },
    async ({ item_id }) => {
      await getClient().archiveItem(item_id);
      return {
        content: [{ type: "text", text: `Archived item #${item_id}` }],
      };
    },
  );

  server.tool(
    "star_item",
    "Toggle the star/bookmark on a task or note",
    {
      item_id: z.number().describe("The item ID to star/unstar"),
    },
    async ({ item_id }) => {
      const item = await getClient().starItem(item_id);
      const status = item.isStarred ? "starred" : "unstarred";
      return {
        content: [
          {
            type: "text",
            text: `Item #${item._id} ${status}: ${item.description}`,
          },
        ],
      };
    },
  );

  server.tool(
    "get_status",
    "Check taskbook server health and current user info",
    {},
    async () => {
      const client = getClient();
      const [health, me] = await Promise.all([client.health(), client.me()]);
      const items = await client.getItems();
      const tasks = Object.values(items).filter((i) => i._isTask);
      const done = tasks.filter((t) => t._isTask && t.isComplete).length;
      const pending = tasks.length - done;
      const notes = Object.values(items).filter((i) => !i._isTask).length;
      const boards = await client.listBoards();

      const lines = [
        `**Taskbook Status**`,
        `Server: ${health.status}`,
        `User: ${me.username} (${me.email})`,
        `Boards: ${boards.length} (${boards.map((b) => `@${b}`).join(", ")})`,
        `Tasks: ${tasks.length} total (${done} done, ${pending} pending)`,
        `Notes: ${notes}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
