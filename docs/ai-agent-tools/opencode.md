# OpenCode — Taskbook MCP Configuration

Config file: `~/.config/opencode/config.json`

## stdio Transport (Local)

```json
{
  "mcp": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

### With Environment Variables

```json
{
  "mcp": {
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

## Verification

1. Start OpenCode
2. Ask: "List my taskbook boards"
3. OpenCode should discover and use the `list_boards` MCP tool

## Reference

- [Environment Variables](../guides/mcp/env-variables.md) — all `TB_*` variables
- [Tools Reference](../guides/mcp/tools-reference.md) — all 15 MCP tools
- [Authelia SSO Guide](../guides/auth/authelia-sso.md) — OIDC setup
