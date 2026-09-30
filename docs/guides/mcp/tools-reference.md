---
title: MCP Tools Reference
description: Complete reference for all 15 taskbook MCP tools and 4 resources
---

# MCP Tools Reference

The taskbook MCP server exposes **15 tools** and **4 resources** via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Tools

### Task Management

#### `list_tasks`

List all tasks, optionally filtered by board.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `board` | string | — | Board name to filter by |

#### `create_task`

Create a new task on a board.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `description` | string | ✅ | Task description |
| `board` | string | — | Board name (default: `My Board`) |
| `priority` | number (1–3) | — | 1=normal, 2=medium, 3=high |
| `tags` | string[] | — | Tags to attach |

#### `complete_task`

Toggle a task's completion status.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task_id` | number | ✅ | Task ID |

#### `begin_task`

Toggle a task's in-progress status.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task_id` | number | ✅ | Task ID |

#### `set_task_priority`

Set a task's priority level.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task_id` | number | ✅ | Task ID |
| `priority` | number (1–3) | ✅ | 1=normal, 2=medium, 3=high |

### Note Management

#### `list_notes`

List all notes, optionally filtered by board.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `board` | string | — | Board name to filter by |

#### `create_note`

Create a new note on a board.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `description` | string | ✅ | Note title/description |
| `board` | string | — | Board name (default: `My Board`) |
| `body` | string | — | Note body content |
| `tags` | string[] | — | Tags to attach |

### Board Management

#### `list_boards`

List all boards with item counts.

No parameters.

#### `move_item`

Move a task or note to a different board.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item_id` | number | ✅ | Item ID to move |
| `target_board` | string | ✅ | Target board name |

### General

#### `search_items`

Search tasks and notes by description, tag, or board name.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | ✅ | Search query text |

#### `edit_item`

Edit an item's description.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item_id` | number | ✅ | Item ID |
| `description` | string | ✅ | New description |

#### `delete_item`

Permanently delete a task or note.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item_id` | number | ✅ | Item ID |

#### `archive_item`

Move an item to the archive.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item_id` | number | ✅ | Item ID |

#### `star_item`

Toggle the star/bookmark on a task or note.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item_id` | number | ✅ | Item ID |

> **Known issue:** `star_item` may return HTTP 500 from the server (see [#6](https://github.com/tobiashochguertel/taskbook/issues/6)).

#### `get_status`

Check taskbook server health and current user info.

No parameters. Returns server health, user info, board list, and task counts.

## Resources

| URI | Type | Description |
|---|---|---|
| `taskbook://status` | Static | Server health and user info (JSON) |
| `taskbook://boards/{boardName}` | Template | Tasks and notes on a specific board (JSON) |
| `taskbook://items` | Static | All tasks and notes across all boards (JSON) |
| `taskbook://archive` | Static | Archived items (JSON) |

## Tool Selection in AI Agent Config

Most AI agents let you select which tools to expose:

```jsonc
// All tools
"tools": ["*"]

// Only read-only tools
"tools": [
  "list_tasks", "list_notes", "list_boards",
  "search_items", "get_status"
]

// Task management only
"tools": [
  "list_tasks", "create_task", "complete_task",
  "begin_task", "set_task_priority"
]

// Exclude destructive operations
"tools": [
  "list_tasks", "list_notes", "list_boards",
  "create_task", "create_note", "complete_task",
  "begin_task", "set_task_priority", "edit_item",
  "move_item", "search_items", "get_status", "star_item"
]
```
