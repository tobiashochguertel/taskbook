# Claude Desktop — Taskbook MCP Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

> **Note:** Claude Desktop does not expand shell variables in JSON. Paste literal values.

## Verification

1. Restart Claude Desktop after saving the config
2. Click the MCP icon in the chat input area
3. Verify "taskbook" appears in the server list
4. Ask: "List my taskbook boards"

## Reference

- [Environment Variables](../guides/mcp/env-variables.md) — all `TB_*` variables
- [Tools Reference](../guides/mcp/tools-reference.md) — all 15 MCP tools
- [Authelia SSO Guide](../guides/auth/authelia-sso.md) — OIDC setup
- [Claude Desktop MCP Setup](https://modelcontextprotocol.io/docs/getting-started/intro)
