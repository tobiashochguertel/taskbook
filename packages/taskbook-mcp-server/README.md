# 🎯 Taskbook MCP Server

[![npm](https://img.shields.io/npm/v/@tobiashochguertel/taskbook-mcp-server)](https://www.npmjs.com/package/@tobiashochguertel/taskbook-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Model Context Protocol (MCP) server for [Taskbook](https://github.com/tobiashochguertel/taskbook)** — manage tasks, notes, and boards from any MCP-compatible AI tool.

The `taskbook-mcp` server connects LLM clients (GitHub Copilot, Claude Desktop, Cursor, VS Code, OpenCode, etc.) to a Taskbook sync server, providing 15 tools and 4 resources for full task management through natural language.

---

## 🚀 Quick Start

### Prerequisites

1. A running **Taskbook sync server**
2. Authenticated via the `tb` CLI — run `tb --login` to create `~/.taskbook.json`

### Install from npm

```bash
# Install globally (requires Bun)
bun add -g @tobiashochguertel/taskbook-mcp-server

# Verify installation
taskbook-mcp --help
```

### Run

```bash
# stdio mode (default) — used by all local AI tools
taskbook-mcp

# HTTP mode — for multi-client / server deployments
taskbook-mcp --transport=http --port=3100
```

The server reads credentials from `~/.taskbook.json` automatically. No extra configuration needed if you've already logged in with `tb --login`.

---

## 🔧 AI Tool Configuration

All local AI tools use **stdio transport** — the tool spawns `taskbook-mcp` as a child process and communicates over stdin/stdout.

<details>
<summary><strong>GitHub Copilot CLI</strong></summary>

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code (GitHub Copilot)</strong></summary>

Add to `.vscode/mcp.json` or `~/.vscode/mcp.json`:

```json
{
  "servers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

</details>

> 💡 **Tip:** For HTTP transport configuration, environment variables, and advanced DevOps setups (Docker, Traefik, Authelia), see the [detailed configuration guides](../../docs/ai-agent-tools/).

### Environment Variables

If you don't have `~/.taskbook.json`, pass credentials via environment variables:

```json
{
  "env": {
    "TB_SERVER_URL": "https://your-taskbook-server.example.com",
    "TB_TOKEN": "your-session-token",
    "TB_ENCRYPTION_KEY": "your-encryption-key"
  }
}
```

---

## 🛠 Available MCP Tools

| Tool                | Description                                          | Parameters                                    |
| ------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `list_tasks`        | List all tasks, optionally filtered by board         | `board?`                                      |
| `create_task`       | Create a new task on a board                         | `description`, `board?`, `priority?`, `tags?` |
| `complete_task`     | Toggle a task's completion status                    | `task_id`                                     |
| `begin_task`        | Toggle a task's in-progress status                   | `task_id`                                     |
| `set_task_priority` | Set priority level (1=normal, 2=medium, 3=high)      | `task_id`, `priority`                         |
| `list_notes`        | List all notes, optionally filtered by board         | `board?`                                      |
| `create_note`       | Create a new note on a board                         | `description`, `board?`, `body?`, `tags?`     |
| `list_boards`       | List all boards with item counts                     | —                                             |
| `move_item`         | Move a task or note to a different board             | `item_id`, `target_board`                     |
| `search_items`      | Search tasks and notes by description, tag, or board | `query`                                       |
| `edit_item`         | Edit an item's description                           | `item_id`, `description`                      |
| `delete_item`       | Permanently delete a task or note                    | `item_id`                                     |
| `archive_item`      | Move an item to the archive                          | `item_id`                                     |
| `star_item`         | Toggle the star/bookmark on an item                  | `item_id`                                     |
| `get_status`        | Server health, user info, and item statistics        | —                                             |

---

## 📦 Available MCP Resources

| URI                             | Name        | Description                                         |
| ------------------------------- | ----------- | --------------------------------------------------- |
| `taskbook://status`             | `status`    | Server health and authenticated user info (JSON)    |
| `taskbook://boards/{boardName}` | `board`     | Tasks and notes on a specific board (JSON, dynamic) |
| `taskbook://items`              | `all-items` | All tasks and notes across all boards (JSON)        |
| `taskbook://archive`            | `archive`   | All archived tasks and notes (JSON)                 |

The `board` resource is dynamic — it lists available boards and lets clients browse individual board contents.

---

## 📝 Environment Variables

| Variable              | Default                 | Description                                |
| --------------------- | ----------------------- | ------------------------------------------ |
| `TB_MCP_TRANSPORT`    | `stdio`                 | Transport type: `stdio` or `http`          |
| `TB_MCP_PORT`         | `3100`                  | HTTP transport listen port                 |
| `TB_MCP_HOST`         | `127.0.0.1`             | HTTP transport bind address                |
| `TB_MCP_ACCESS_TOKEN` | —                       | Bearer token required for HTTP connections |
| `TB_SERVER_URL`       | from `~/.taskbook.json` | Taskbook sync server URL                   |
| `TB_TOKEN`            | from `~/.taskbook.json` | Taskbook session/auth token                |
| `TB_ENCRYPTION_KEY`   | from `~/.taskbook.json` | AES-256-GCM client-side encryption key     |
| `TB_CONFIG_PATH`      | `~/.taskbook.json`      | Path to taskbook configuration file        |

Environment variables **override** values from `~/.taskbook.json`. If all three `TB_SERVER_URL`, `TB_TOKEN`, and `TB_ENCRYPTION_KEY` are set, the config file is not read at all.

---

## 🌐 HTTP Transport

The HTTP transport enables **multi-client** deployments with per-session `TaskbookClient` instances using MCP Streamable HTTP.

```bash
# Start in HTTP mode
taskbook-mcp --transport=http --port=3100 --host=0.0.0.0
```

| Endpoint  | Method   | Description                                     |
| --------- | -------- | ----------------------------------------------- |
| `/mcp`    | `POST`   | MCP JSON-RPC requests (initialize + tool calls) |
| `/mcp`    | `GET`    | Server-to-client streaming (notifications)      |
| `/mcp`    | `DELETE` | Close a session                                 |
| `/health` | `GET`    | Health check — returns `{ "status": "ok" }`     |

### Docker

```bash
docker run -p 3100:3100 \
  -e TB_SERVER_URL=https://your-taskbook-server.example.com \
  -e TB_TOKEN=your-token \
  -e TB_ENCRYPTION_KEY=your-key \
  ghcr.io/tobiashochguertel/taskbook-mcp-server:latest
```

> For advanced setups (Docker Compose, Traefik, Authelia/OIDC), see the [DevOps guide](../../docs/ai-agent-tools/devops-http-setup.md).

---

## 👩‍💻 Development

```bash
cd packages/taskbook-mcp-server
bun install          # Install dependencies
bun run dev          # Development mode (watch)
bun run typecheck    # Type checking
bun run lint         # Linting (Biome)
bun run build        # Build bundled JS
bun run build:standalone  # Build standalone binary
bun test             # Run tests
```

---

## 📄 License

[MIT](LICENSE) — see [Taskbook](https://github.com/tobiashochguertel/taskbook) for full project details.
