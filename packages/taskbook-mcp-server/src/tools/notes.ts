import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskbookClient, Note } from "../client/api.js";

function formatNote(n: Note): string {
  const star = n.isStarred ? "★ " : "";
  const tags =
    n.tags && n.tags.length > 0 ? ` +${n.tags.join(" +")}` : "";
  const boards = (n.boards ?? []).map((b) => `@${b}`).join(" ");
  const body = n.body ? `\n   ${n.body}` : "";
  return `📝 ${n._id}. ${star}${n.description}${tags}  (${boards})${body}`;
}

export function registerNoteTools(
  server: McpServer,
  getClient: () => TaskbookClient,
) {
  server.tool(
    "list_notes",
    "List all notes, optionally filtered by board",
    { board: z.string().optional().describe("Board name to filter by") },
    async ({ board }) => {
      const notes = await getClient().listNotes(board);
      if (notes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: board
                ? `No notes found on board @${board}.`
                : "No notes found.",
            },
          ],
        };
      }
      const lines = [
        `**Notes** (${notes.length})`,
        "",
        ...notes.map(formatNote),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "create_note",
    "Create a new note on a board",
    {
      description: z.string().describe("Note title/description"),
      board: z.string().optional().describe("Board name (default: My Board)"),
      body: z.string().optional().describe("Note body content"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags to attach to the note"),
    },
    async ({ description, board, body, tags }) => {
      const note = await getClient().createNote(
        description,
        board ?? "My Board",
        body,
        tags ?? [],
      );
      return {
        content: [
          {
            type: "text",
            text: `Created note #${note._id}: ${note.description} on @${note.boards[0]}`,
          },
        ],
      };
    },
  );
}
