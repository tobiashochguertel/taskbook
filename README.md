---
title: "Taskbook"
description: "Tasks, boards & notes for the command-line habitat — Rust rewrite"
last_updated: "2025-07-18"
---

# taskbook

A Rust port of [taskbook](https://github.com/klaussinani/taskbook) — tasks, boards & notes for the command-line habitat.

![Board View](screenshots/taskbook.png)

## Architecture

```mermaid
graph TB
    subgraph "Client"
        CLI["tb CLI (Rust)"]
        MCP["MCP Server (TypeScript/Bun)"]
    end
    subgraph "Server"
        API["tb-server (Rust/Axum)"]
        WebUI["WebUI (React/Vite)"]
        DB[(PostgreSQL)]
    end
    CLI --> API
    MCP --> API
    WebUI --> API
    API --> DB
```

## Packages

| Component                                           | Language   | Description                   |
| --------------------------------------------------- | ---------- | ----------------------------- |
| [taskbook-client](crates/taskbook-client)           | Rust       | TUI CLI client (`tb`)         |
| [taskbook-server](crates/taskbook-server)           | Rust       | REST API server (`tb-server`) |
| [taskbook-common](crates/taskbook-common)           | Rust       | Shared types and encryption   |
| [taskbook-webui](packages/taskbook-webui)           | TypeScript | React web interface           |
| [taskbook-mcp-server](packages/taskbook-mcp-server) | TypeScript | MCP protocol server           |

## Features

- Create and manage tasks and notes organized into boards
- Priority levels and progress tracking
- Timeline, journal, and archive views
- Customizable themes (including Catppuccin)
- **Optional server sync** with end-to-end encryption (AES-256-GCM)
- **Web UI** — React SPA served by tb-server
- **MCP server** — AI tool integration via Model Context Protocol
- **OIDC/SSO** — single sign-on for server authentication

## Installation

### Binary Downloads

Download the latest binary for your platform from [GitHub Releases](https://github.com/taskbook-sh/taskbook/releases).

### Cargo

```bash
cargo install --path crates/taskbook-client
```

### Docker

```bash
docker compose up -d server postgres
```

See [docker-compose.yml](docker-compose.yml) for the full service definition (server, postgres, client, mcp-server).

### Nix Flake

```nix
{
  inputs.taskbook.url = "github:taskbook-sh/taskbook";

  # Add to your packages
  environment.systemPackages = [ inputs.taskbook.packages.${system}.default ];
}
```

## Screenshots

### Board View

Organize tasks and notes into boards with priority levels and progress tracking.

![Board View](screenshots/taskbook.png)

### Timeline View

View all items chronologically, grouped by date.

![Timeline View](screenshots/timeline.png)

### Journal View

A detailed journal of all activity with timestamps.

![Journal View](screenshots/journal.png)

### Commands

Access commands directly from the TUI with `/` or Tab.

![Commands](screenshots/commands.png)

### Help

Full keyboard shortcut reference available with `?`.

![Help](screenshots/help.png)

### Archive View

Browse and restore deleted items.

![Archive View](screenshots/archive.png)

## Usage

```bash
tb                          # Display board view
tb --task "Description"     # Create task
tb --task @board "Desc"     # Create task in specific board
tb --task "Desc" p:2        # Create with priority (1=normal, 2=medium, 3=high)
tb --note "Description"     # Create note
tb --note                   # Create note in external editor
tb --edit-note @<id>        # Edit note in external editor
tb --check <id> [id...]     # Toggle task complete
tb --begin <id> [id...]     # Toggle task in-progress
tb --star <id> [id...]      # Toggle starred
tb --delete <id> [id...]    # Delete to archive
tb --restore <id> [id...]   # Restore from archive
tb --edit @<id> "New desc"  # Edit description
tb --move @<id> board       # Move to board
tb --priority @<id> <1-3>   # Set priority
tb --find <term>            # Search items
tb --list <attributes>      # Filter (pending, done, task, note, starred)
tb --timeline               # Chronological view
tb --archive                # View archived items
tb --clear                  # Delete all completed tasks
tb --copy <id> [id...]      # Copy descriptions to clipboard
```

## Server Sync

Optionally sync your tasks across devices with encrypted server storage:

```bash
# Register an account (interactive)
tb --register

# Migrate existing local data to server
tb --migrate

# On another device, login with your encryption key
tb --login

# Check sync status
tb --status

# Logout and return to local-only mode
tb --logout
```

All data is encrypted client-side with AES-256-GCM before being sent to the server. Your encryption key is generated locally during registration and never leaves your device.

The server supports **OIDC/SSO** login (e.g. Authelia, Keycloak) — set `TB_OIDC_ISSUER` to enable single sign-on. See [Server Setup](docs/server.md) for details.

## MCP Server

The [MCP server](packages/taskbook-mcp-server) exposes taskbook operations as tools for AI assistants (GitHub Copilot, Claude, VS Code, Cursor, etc.) via the [Model Context Protocol](https://modelcontextprotocol.io).

```bash
# stdio transport (default for editor integrations)
bunx @tobiashochguertel/taskbook-mcp-server

# HTTP transport (for remote/Docker deployments)
TB_MCP_TRANSPORT=http TB_MCP_PORT=3100 bunx @tobiashochguertel/taskbook-mcp-server
```

See the [MCP server README](packages/taskbook-mcp-server/README.md) for configuration and tool reference.

## Configuration

Configuration is stored in `~/.taskbook.json`:

```json
{
  "taskbookDirectory": "~",
  "displayCompleteTasks": true,
  "displayProgressOverview": true,
  "theme": "catppuccin-macchiato",
  "sync": {
    "enabled": false,
    "serverUrl": "http://localhost:8080"
  }
}
```

### Themes

Available preset themes: `default`, `catppuccin-macchiato`, `catppuccin-mocha`, `catppuccin-frappe`, `catppuccin-latte`, `high-contrast`

Or define custom RGB colors - see [Configuration docs](docs/configuration.md).

## Documentation

See the [docs](docs/) folder for detailed documentation:

- [Installation](docs/installation.md)
- [CLI Reference](docs/cli-reference.md)
- [Configuration](docs/configuration.md)
- [Server Setup](docs/server.md)
- [Sync & Encryption](docs/sync.md)
- [Kubernetes Deployment](docs/kubernetes.md)
- [Observability](docs/observability.md)

### Per-Package READMEs

- [taskbook-mcp-server](packages/taskbook-mcp-server/README.md) — MCP tools, transports, AI editor setup
- [taskbook-webui](packages/taskbook-webui/README.md) — React web interface development

## Data Compatibility

This implementation uses the same data format and directory (`~/.taskbook/`) as the original Node.js version, allowing seamless migration.

## License

MIT - see [LICENSE](LICENSE)

## Credits

Original project by [Klaus Sinani](https://github.com/klaussinani/taskbook)
