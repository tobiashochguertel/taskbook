import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskbookClient } from "../client/api.js";

export function registerBoardTools(
  server: McpServer,
  getClient: () => TaskbookClient,
) {
  server.tool(
    "list_boards",
    "List all boards with item counts",
    {},
    async () => {
      const items = await getClient().getItems();
      const boardCounts = new Map<string, { tasks: number; notes: number }>();

      for (const item of Object.values(items)) {
        for (const board of item.boards) {
          const counts = boardCounts.get(board) ?? { tasks: 0, notes: 0 };
          if (item._isTask) counts.tasks++;
          else counts.notes++;
          boardCounts.set(board, counts);
        }
      }

      if (boardCounts.size === 0) {
        return {
          content: [{ type: "text", text: "No boards found." }],
        };
      }

      const lines = [
        "**Boards**",
        "",
        ...[...boardCounts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([name, counts]) =>
              `📋 @${name}  (${counts.tasks} tasks, ${counts.notes} notes)`,
          ),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "move_item",
    "Move a task or note to a different board",
    {
      item_id: z.number().describe("The item ID to move"),
      target_board: z.string().describe("The target board name"),
    },
    async ({ item_id, target_board }) => {
      const item = await getClient().moveToBoard(item_id, target_board);
      return {
        content: [
          {
            type: "text",
            text: `Moved item #${item._id} to @${item.boards[0]}`,
          },
        ],
      };
    },
  );
}
