import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskbookClient, Task } from "../client/api.js";

function formatTask(t: Task): string {
  const status = t.isComplete ? "✔" : t.inProgress ? "…" : "☐";
  const star = t.isStarred ? "★ " : "";
  const pri = t.priority > 1 ? ` [P${t.priority}]` : "";
  const tags =
    t.tags && t.tags.length > 0 ? ` +${t.tags.join(" +")}` : "";
  const boards = (t.boards ?? []).map((b) => `@${b}`).join(" ");
  return `${status} ${t._id}. ${star}${t.description}${pri}${tags}  (${boards})`;
}

export function registerTaskTools(
  server: McpServer,
  getClient: () => TaskbookClient,
) {
  server.tool(
    "list_tasks",
    "List all tasks, optionally filtered by board name",
    { board: z.string().optional().describe("Board name to filter by") },
    async ({ board }) => {
      const tasks = await getClient().listTasks(board);
      if (tasks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: board
                ? `No tasks found on board @${board}.`
                : "No tasks found.",
            },
          ],
        };
      }
      const pending = tasks.filter((t) => !t.isComplete);
      const done = tasks.filter((t) => t.isComplete);
      const lines = [
        `**Tasks** (${pending.length} pending, ${done.length} done)`,
        "",
        ...pending.map(formatTask),
        ...(done.length > 0 ? ["", "--- Completed ---", ...done.map(formatTask)] : []),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "create_task",
    "Create a new task on a board",
    {
      description: z.string().describe("Task description"),
      board: z.string().optional().describe("Board name (default: My Board)"),
      priority: z
        .number()
        .min(1)
        .max(3)
        .optional()
        .describe("Priority 1-3 (1=normal, 2=medium, 3=high)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to attach to the task"),
    },
    async ({ description, board, priority, tags }) => {
      const task = await getClient().createTask(
        description,
        board ?? "My Board",
        priority ?? 1,
        tags ?? [],
      );
      return {
        content: [
          {
            type: "text",
            text: `Created task #${task._id}: ${task.description} on @${task.boards[0]}`,
          },
        ],
      };
    },
  );

  server.tool(
    "complete_task",
    "Toggle a task's completion status",
    {
      task_id: z.number().describe("The task ID number"),
    },
    async ({ task_id }) => {
      const task = await getClient().completeTask(task_id);
      const status = task.isComplete ? "completed" : "uncompleted";
      return {
        content: [
          {
            type: "text",
            text: `Task #${task._id} marked as ${status}: ${task.description}`,
          },
        ],
      };
    },
  );

  server.tool(
    "begin_task",
    "Toggle a task's in-progress status",
    {
      task_id: z.number().describe("The task ID number"),
    },
    async ({ task_id }) => {
      const task = await getClient().beginTask(task_id);
      const status = task.inProgress ? "in-progress" : "paused";
      return {
        content: [
          {
            type: "text",
            text: `Task #${task._id} marked as ${status}: ${task.description}`,
          },
        ],
      };
    },
  );

  server.tool(
    "set_task_priority",
    "Set a task's priority level (1=normal, 2=medium, 3=high)",
    {
      task_id: z.number().describe("The task ID number"),
      priority: z.number().min(1).max(3).describe("Priority level 1-3"),
    },
    async ({ task_id, priority }) => {
      const client = getClient();
      const items = await client.getItems();
      const item = items[String(task_id)];
      if (!item || !item._isTask) throw new Error(`Task ${task_id} not found`);
      (item as Task).priority = priority;
      items[String(task_id)] = item;
      await client.putItems(items);
      return {
        content: [
          {
            type: "text",
            text: `Task #${task_id} priority set to P${priority}`,
          },
        ],
      };
    },
  );
}
