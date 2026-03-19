# GitHub Copilot CLI — Taskbook MCP Configuration

## stdio Transport (Local)

Add to `~/.copilot/mcp-config.json`:

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
      "url": "https://your-mcp-server.example.com/mcp"
    }
  }
}
```

## Verification

```bash
copilot -p "List all tools from the taskbook MCP server." --model gpt-4.1 --allow-all-tools
```

Expected: All 15 taskbook tools are discovered and listed.

## Reference

- [Copilot CLI Documentation](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli)
- `copilot help config`
