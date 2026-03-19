---
title: Environment Variables Reference
description: All TB_* environment variables for taskbook server, client, and MCP server
---

# Environment Variables Reference

All taskbook packages use `TB_`-prefixed environment variables.
Environment variables **override** values from config files (`~/.taskbook.json`).

## Taskbook Server (`tb-server`)

### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_DB_HOST` | ✅ | — | PostgreSQL hostname |
| `TB_DB_PORT` | — | `5432` | PostgreSQL port |
| `TB_DB_NAME` | ✅ | — | PostgreSQL database name |
| `TB_DB_USER` | ✅ | — | PostgreSQL username |
| `TB_DB_PASSWORD` | ✅ | — | PostgreSQL password |

### Network

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_HOST` | — | `0.0.0.0` | Server bind address |
| `TB_PORT` | — | `8080` | Server bind port |
| `TB_CORS_ORIGINS` | — | (empty) | Comma-separated allowed CORS origins |

### Sessions

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_SESSION_EXPIRY_DAYS` | — | `30` | Session token lifetime in days |

### OIDC / SSO

OIDC is enabled when **all three** of `TB_OIDC_ISSUER`, `TB_OIDC_CLIENT_ID`, and `TB_OIDC_CLIENT_SECRET` are set.

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_OIDC_ISSUER` | Conditional | — | OIDC provider issuer URL |
| `TB_OIDC_CLIENT_ID` | Conditional | — | OIDC client ID |
| `TB_OIDC_CLIENT_SECRET` | Conditional | — | OIDC client secret |
| `TB_OIDC_BASE_URL` | — | `http://{TB_HOST}:{TB_PORT}` | Public base URL for redirect URI |
| `TB_OIDC_ALLOWED_REDIRECTS` | — | (empty) | Comma-separated post-login redirect URI prefixes |

### Logging

| Variable | Required | Default | Description |
|---|---|---|---|
| `RUST_LOG` | — | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error` |

## Taskbook Client (`tb`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `TASKBOOK_DIR` | — | `~/.taskbook` | Custom data directory. Priority: CLI flag > env > config > default |
| `TB_SERVER_URL` | — | from `~/.taskbook.json` | Server URL (overrides config file) |
| `TB_TOKEN` | — | from `~/.taskbook.json` | Session auth token (overrides config file) |
| `TB_ENCRYPTION_KEY` | — | from `~/.taskbook.json` | E2E encryption key (overrides config file) |

### Build-Time Variables (set automatically during compilation)

| Variable | Description |
|---|---|
| `TB_PKG_VERSION` | Package version from Cargo.toml |
| `TB_GIT_HASH` | Git short commit hash |
| `TB_GIT_BRANCH` | Git branch name |
| `TB_GIT_TAG` | Git tag |
| `TB_GIT_REPO` | Repository remote URL |
| `TB_BUILD_DATE` | Build timestamp (UTC) |

## MCP Server (`taskbook-mcp`)

### Transport

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_MCP_TRANSPORT` | — | `stdio` | Transport: `stdio` (single client) or `http` (multi-client) |
| `TB_MCP_HOST` | — | `127.0.0.1` | HTTP bind address (only when `http`) |
| `TB_MCP_PORT` | — | `3100` | HTTP bind port (only when `http`) |

### Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_MCP_ACCESS_TOKEN` | — | (none) | Bearer token for HTTP connections. When set, all HTTP requests must include `Authorization: Bearer <token>` |

### Server Connection

These variables connect the MCP server to the taskbook API. They override values from `~/.taskbook.json`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_SERVER_URL` | — | from `~/.taskbook.json` | Taskbook server URL |
| `TB_TOKEN` | — | from `~/.taskbook.json` | Taskbook session auth token |
| `TB_ENCRYPTION_KEY` | — | from `~/.taskbook.json` | E2E encryption key |
| `TB_CONFIG_PATH` | — | `~/.taskbook.json` | Path to config file |

## Docker / Deployment

| Variable | Required | Default | Description |
|---|---|---|---|
| `TB_VERSION` | — | `latest` | Container image version tag |
| `POSTGRES_USER` | — | `taskbook` | PostgreSQL superuser |
| `POSTGRES_PASSWORD` | — | `taskbook` | PostgreSQL superuser password |
| `POSTGRES_DB` | — | `taskbook` | PostgreSQL database name |

## How to Determine Values

### `TB_TOKEN` and `TB_ENCRYPTION_KEY`

These are created automatically when you log in:

```bash
tb --login
# Follow the SSO flow in your browser
# Credentials are saved to ~/.taskbook.json
```

To extract them from the config file:

```bash
cat ~/.taskbook.json | jq '.sync.token'        # TB_TOKEN
cat ~/.taskbook.json | jq '.encryption_key'     # TB_ENCRYPTION_KEY
cat ~/.taskbook.json | jq '.sync.server_url'    # TB_SERVER_URL
```

### `TB_MCP_ACCESS_TOKEN`

Generate a secure random token:

```bash
openssl rand -base64 32
```

Use the same value in the MCP server env and in your AI agent config's `Authorization` header.

### Shell Environment Reuse

If your shell already has `TB_SERVER_URL`, `TB_TOKEN`, and `TB_ENCRYPTION_KEY` exported, AI agent tools can reference them:

```jsonc
// copilot-cli example — reference shell vars
{
  "headers": {
    "Authorization": "Bearer ${TB_MCP_ACCESS_TOKEN}"
  }
}
```

> **Note:** Variable interpolation depends on the AI agent tool. Some tools (Claude Desktop, VS Code) do not expand shell variables in JSON config. In those cases, paste the literal value.
