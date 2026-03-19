# GitHub Copilot CLI — Taskbook MCP Configuration

Config file: `~/.copilot/mcp-config.json`

## stdio Transport (Local)

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

### With Environment Variables

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp",
      "env": {
        "TB_SERVER_URL": "https://your-taskbook-server.example.com",
        "TB_TOKEN": "your-session-token",
        "TB_ENCRYPTION_KEY": "your-encryption-key"
      }
    }
  }
}
```

## HTTP Transport (Remote Server)

```json
{
  "mcpServers": {
    "taskbook": {
      "type": "http",
      "url": "https://your-mcp-server.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <your-TB_MCP_ACCESS_TOKEN>"
      }
    }
  }
}
```

### Config Fields

| Field | Required | Description |
|---|---|---|
| `type` | ✅ | `"http"` for remote server |
| `url` | ✅ | MCP endpoint URL (must end in `/mcp`) |
| `tools` | — | Tool filter: `["*"]` for all, or list specific tools |
| `headers` | — | HTTP headers. Set `Authorization` when `TB_MCP_ACCESS_TOKEN` is configured |
| `source` | — | Set by Copilot CLI to track where the config came from (`"user"` = manual) |

## Tool Selection

```jsonc
// All tools (default)
"tools": ["*"]

// Read-only
"tools": ["list_tasks", "list_notes", "list_boards", "search_items", "get_status"]
```

> See [Tools Reference](../guides/mcp/tools-reference.md) for the full list of 15 tools.

## Verification

```bash
copilot -p "List all tools from the taskbook MCP server." --model gpt-4.1 --allow-all-tools
```

Expected: All 15 taskbook tools are discovered and listed.

## Reference

- [Environment Variables](../guides/mcp/env-variables.md) — all `TB_*` variables
- [Tools Reference](../guides/mcp/tools-reference.md) — all 15 MCP tools
- [Authelia SSO Guide](../guides/auth/authelia-sso.md) — OIDC setup
- [Copilot CLI Documentation](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli)
- `copilot help config`
