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

### Option A: OAuth (Automatic — Recommended)

When the MCP server has OAuth enabled, Copilot CLI handles authentication
automatically via RFC 8414 discovery and RFC 7591 dynamic client registration.

```json
{
  "mcpServers": {
    "taskbook": {
      "type": "http",
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

Copilot CLI will:
1. Discover OAuth endpoints via `/.well-known/oauth-authorization-server`
2. Register itself as a client via `/oauth/register`
3. Open a browser for SSO login (Authelia)
4. Exchange the authorization code for an access token

### Option B: Personal Access Token (Headless)

For headless environments (CI, scripts, SSH sessions without a browser),
use a PAT in the `Authorization` header:

```json
{
  "mcpServers": {
    "taskbook": {
      "type": "http",
      "url": "https://your-mcp-server.example.com/mcp",
      "headers": {
        "Authorization": "Bearer tb_YOUR_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

Generate a PAT via the WebUI (Profile → Tokens → Create Token) or
via the CLI (`tb token create --name "copilot-cli"`).

### Option C: Static Access Token (Legacy)

If the server uses `TB_MCP_ACCESS_TOKEN`, pass it directly:

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
| `headers` | — | HTTP headers. Only needed for PAT/legacy auth (Options B/C) |
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
- [MCP OAuth Setup](../guides/auth/mcp-oauth-setup.md) — OAuth server configuration
- [Copilot CLI Documentation](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli)
- `copilot help config`
