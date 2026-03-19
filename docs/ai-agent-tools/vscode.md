# VS Code (GitHub Copilot) — Taskbook MCP Configuration

## Workspace Configuration

Add to `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

## Global Configuration

Add to `~/.vscode/mcp.json`:

```json
{
  "servers": {
    "taskbook": {
      "command": "taskbook-mcp"
    }
  }
}
```

## With Environment Variables

```json
{
  "servers": {
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
  "servers": {
    "taskbook": {
      "type": "http",
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

## Verification

1. Open VS Code
2. Open Copilot Chat (Ctrl+Shift+I)
3. Type: "List my taskbook boards"
4. Copilot should use the `list_boards` MCP tool
