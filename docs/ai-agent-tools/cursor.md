# Cursor — Taskbook MCP Configuration

## Configuration

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

1. Restart Cursor after saving the config
2. Open Cursor's AI chat
3. Ask: "List my taskbook boards"
4. Cursor should use the `list_boards` MCP tool
