# OpenCode — Taskbook MCP Configuration

## Configuration

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

## With Environment Variables

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
