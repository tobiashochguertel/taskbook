# Claude Desktop — Taskbook MCP Configuration

## Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

## With Environment Variables

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

## Verification

1. Restart Claude Desktop after saving the config
2. Click the MCP icon in the chat input area
3. Verify "taskbook" appears in the server list
4. Ask: "List my taskbook boards"

## Reference

- [Claude Desktop MCP Setup](https://modelcontextprotocol.io/docs/getting-started/intro)
