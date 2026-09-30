# Cursor — Taskbook MCP Configuration

Config file: `~/.cursor/mcp.json`

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

## Verification

1. Restart Cursor after saving the config
2. Open Cursor's AI chat
3. Ask: "List my taskbook boards"
4. Cursor should use the `list_boards` MCP tool

## Reference

- [Environment Variables](../guides/mcp/env-variables.md) — all `TB_*` variables
- [Tools Reference](../guides/mcp/tools-reference.md) — all 15 MCP tools
- [Authelia SSO Guide](../guides/auth/authelia-sso.md) — OIDC setup
