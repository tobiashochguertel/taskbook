---
title: "MCP Server Overview"
description: "Model Context Protocol server for AI tool integration"
last_updated: "2025-07-18"
audience:
  - developers
  - ai-agents
---

# MCP Server

The **taskbook-mcp-server** is a TypeScript/Bun package that exposes Taskbook task management to MCP-compatible AI tools such as GitHub Copilot, Claude Desktop, Cursor, and others.

It connects to a Taskbook sync server and provides tools and resources for creating, managing, and querying tasks and notes through natural language.

## Documentation

For full setup instructions, available tools, resources, and AI client configuration, see the package README:

👉 [packages/taskbook-mcp-server/README.md](../../packages/taskbook-mcp-server/README.md)

## Architecture

```mermaid
flowchart LR
    AI["AI Client\n(Copilot, Claude, Cursor)"]
    MCP["taskbook-mcp-server\n(TypeScript/Bun)"]
    API["tb-server\n(REST API)"]
    AI <-->|MCP Protocol| MCP
    MCP <-->|HTTPS| API
```
