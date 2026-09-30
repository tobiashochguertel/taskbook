import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Task, TaskbookClient } from "../client/api.js";

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

  server.tool(
    "get_item",
    "Get a specific task or note by its ID",
    {
      item_id: z.number().describe("The item ID to retrieve"),
    },
    async ({ item_id }) => {
      const items = await getClient().getItems();
      const item = items[String(item_id)];
      if (!item) {
        return {
          content: [{ type: "text", text: `Item #${item_id} not found.` }],
          isError: true,
        };
      }
      const type = item._isTask ? "Task" : "Note";
      const lines = [
        `**${type} #${item._id}**`,
        `Description: ${item.description}`,
        `Board: @${item.boards.join(", @")}`,
        `Starred: ${item.isStarred ? "⭐ yes" : "no"}`,
      ];
      if (item._isTask) {
        const task = item as Task;
        lines.push(`Status: ${task.isComplete ? "✔ complete" : task.inProgress ? "⏳ in-progress" : "☐ pending"}`);
        lines.push(`Priority: P${task.priority}`);
      }
      if (item.tags && item.tags.length > 0) {
        lines.push(`Tags: ${item.tags.map((t: string) => `+${t}`).join(" ")}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_board",
    "Get all tasks and notes on a specific board",
    {
      board: z.string().describe("Board name (e.g. 'My Board')"),
    },
    async ({ board }) => {
      const client = getClient();
      const boardName = board.replace(/^@+/, "");
      const [tasks, notes] = await Promise.all([
        client.listTasks(boardName),
        client.listNotes(boardName),
      ]);
      if (tasks.length === 0 && notes.length === 0) {
        return {
          content: [{ type: "text", text: `Board "@${boardName}" is empty or does not exist.` }],
        };
      }
      const lines = [`**@${boardName}** (${tasks.length} tasks, ${notes.length} notes)`, ""];
      if (tasks.length > 0) {
        const pending = tasks.filter((t) => !t.isComplete);
        const done = tasks.filter((t) => t.isComplete);
        if (pending.length > 0) {
          lines.push("**Pending:**");
          for (const t of pending) {
            const status = t.inProgress ? "⏳" : "☐";
            const prio = t.priority > 1 ? ` [P${t.priority}]` : "";
            const star = t.isStarred ? " ⭐" : "";
            lines.push(`  ${status} ${t._id}. ${t.description}${prio}${star}`);
          }
        }
        if (done.length > 0) {
          lines.push("**Completed:**");
          for (const t of done) {
            lines.push(`  ✔ ${t._id}. ${t.description}`);
          }
        }
      }
      if (notes.length > 0) {
        lines.push("**Notes:**");
        for (const n of notes) {
          lines.push(`  📝 ${n._id}. ${n.description}`);
        }
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "list_archive",
    "List all archived tasks and notes",
    {},
    async () => {
      const items = await getClient().getArchive();
      const all = Object.values(items);
      if (all.length === 0) {
        return {
          content: [{ type: "text", text: "Archive is empty." }],
        };
      }
      const lines = [`**Archive** (${all.length} items)`, ""];
      for (const item of all) {
        const type = item._isTask ? (item.isComplete ? "✔" : "☐") : "📝";
        lines.push(`  ${type} ${item._id}. ${item.description}  (@${item.boards.join(", @")})`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
