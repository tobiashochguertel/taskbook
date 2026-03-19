---
title: Authelia SSO Guide
description: Configure taskbook packages with Authelia OIDC/SSO authentication
---

# Authelia SSO Guide

This guide covers configuring all taskbook packages (server, client, WebUI, MCP server) with [Authelia](https://www.authelia.com/) as the OIDC identity provider.

## Prerequisites

- Authelia instance running and accessible (e.g., `https://auth.example.com`)
- Taskbook server deployed behind a reverse proxy (Traefik, Nginx, Caddy)
- HTTPS with valid certificates on all domains

## 1. Register Taskbook as an Authelia OIDC Client

Add this to your Authelia `configuration.yml` under `identity_providers.oidc.clients`:

```yaml
identity_providers:
  oidc:
    clients:
      - client_id: taskbook
        client_name: Taskbook
        client_secret: '$argon2id$...'  # Generate with: authelia crypto hash generate argon2
        public: false
        authorization_policy: one_factor
        redirect_uris:
          - https://taskbook.example.com/oidc/callback
        scopes:
          - openid
          - profile
          - email
        grant_types:
          - authorization_code
        response_types:
          - code
        token_endpoint_auth_method: client_secret_post
```

Generate the client secret hash:

```bash
# Plain-text secret (save this for TB_OIDC_CLIENT_SECRET)
openssl rand -hex 32

# Hashed version for Authelia config
authelia crypto hash generate argon2 --password '<plain-text-secret>'
```

## 2. Configure the Taskbook Server

Set these environment variables for `tb-server`:

```bash
# Required — enables OIDC
TB_OIDC_ISSUER=https://auth.example.com
TB_OIDC_CLIENT_ID=taskbook
TB_OIDC_CLIENT_SECRET=<plain-text-secret>

# Public URL where users access the server
TB_OIDC_BASE_URL=https://taskbook.example.com

# Allow WebUI and CLI to redirect back after login
TB_OIDC_ALLOWED_REDIRECTS=https://taskbook.example.com,tb://callback

# CORS — allow WebUI origin
TB_CORS_ORIGINS=https://taskbook.example.com,https://webui-taskbook.example.com
```

The redirect URI registered in Authelia must match: `{TB_OIDC_BASE_URL}/oidc/callback`

### Docker Compose Example

```yaml
services:
  taskbook-server:
    image: ghcr.io/tobiashochguertel/taskbook-server:latest
    environment:
      TB_DB_HOST: postgres
      TB_DB_NAME: taskbook
      TB_DB_USER: taskbook
      TB_DB_PASSWORD: ${POSTGRES_PASSWORD}
      TB_PORT: "8080"
      TB_OIDC_ISSUER: https://auth.example.com
      TB_OIDC_CLIENT_ID: taskbook
      TB_OIDC_CLIENT_SECRET: ${TB_OIDC_CLIENT_SECRET}
      TB_OIDC_BASE_URL: https://taskbook.example.com
      TB_OIDC_ALLOWED_REDIRECTS: https://taskbook.example.com,https://webui-taskbook.example.com
      TB_CORS_ORIGINS: https://taskbook.example.com,https://webui-taskbook.example.com
      RUST_LOG: info
```

## 3. Configure the CLI Client

The CLI uses browser-based SSO login:

```bash
# Set the server URL
tb --config-server https://taskbook.example.com

# Login via browser (opens SSO flow)
tb --login

# Verify
tb --status
```

The login flow:
1. CLI opens `{server}/oidc/login?redirect_uri=tb://callback` in your browser
2. Authelia prompts for credentials
3. After authentication, the server issues a session token
4. The CLI saves the token to `~/.taskbook.json`

### Login on a Remote/Headless Host

If the host has no browser (e.g., a VPS):

```bash
tb --login
# Copy the URL printed to the terminal
# Open it in a browser on another machine
# Complete the SSO flow
# The CLI will detect the callback and save credentials
```

## 4. Configure the WebUI

The WebUI inherits OIDC from the server. It redirects unauthenticated users to the SSO login page.

Environment variables for the WebUI container:

```bash
# The WebUI connects to the server API
TB_SERVER_URL=https://taskbook.example.com
```

If the WebUI is on a different subdomain, ensure it's listed in `TB_CORS_ORIGINS` and `TB_OIDC_ALLOWED_REDIRECTS`.

## 5. Configure the MCP Server

The MCP server authenticates to the taskbook API using a session token (not OIDC directly). It needs credentials from a logged-in user:

```bash
# Option A: Use env vars (recommended for containers)
TB_SERVER_URL=https://taskbook.example.com
TB_TOKEN=<session-token-from-login>
TB_ENCRYPTION_KEY=<encryption-key-from-login>
TB_MCP_TRANSPORT=http
TB_MCP_ACCESS_TOKEN=<random-bearer-token>

# Option B: Mount the config file
TB_CONFIG_PATH=/config/.taskbook.json
```

To get the token values, log in with the CLI first:

```bash
tb --login
cat ~/.taskbook.json | jq '{token: .sync.token, key: .encryption_key, url: .sync.server_url}'
```

### Securing the MCP HTTP Endpoint

When using HTTP transport, **always set `TB_MCP_ACCESS_TOKEN`**. This requires all HTTP requests to include a Bearer token:

```bash
# Generate a token
TB_MCP_ACCESS_TOKEN=$(openssl rand -base64 32)
```

Without this, anyone who can reach the MCP endpoint can read and modify your tasks.

If the MCP endpoint is behind Authelia (Traefik forward-auth), you have two layers:
1. **Authelia** — protects browser access (cookie-based)
2. **TB_MCP_ACCESS_TOKEN** — protects programmatic API access (Bearer token)

For AI agents that don't support cookie auth, bypass Authelia for `/mcp` and `/sse` paths and rely on the Bearer token:

```yaml
# Authelia access_control
- domain: mcp-taskbook.example.com
  resources:
    - "^/mcp.*$"
    - "^/sse.*$"
    - "^/health$"
  policy: bypass
- domain: mcp-taskbook.example.com
  policy: one_factor
```

## 6. Verify the Setup

```bash
# Server health
curl -s https://taskbook.example.com/api/health | jq .

# CLI status
tb --status

# MCP server (with token)
curl -s -X POST https://mcp-taskbook.example.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer ${TB_MCP_ACCESS_TOKEN}" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'

# Create a task via CLI and verify in WebUI
tb -t "SSO test task" -b "test"
# Open WebUI → should see the task
```

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| "Session invalid" in `tb --status` | Token expired or server restarted | Run `tb --login` again |
| OIDC callback fails | Redirect URI mismatch | Check `TB_OIDC_BASE_URL` matches the registered `redirect_uris` in Authelia |
| CORS errors in WebUI | WebUI origin not in `TB_CORS_ORIGINS` | Add the WebUI domain to `TB_CORS_ORIGINS` |
| MCP returns 401 | Wrong or missing Bearer token | Verify `TB_MCP_ACCESS_TOKEN` matches the `Authorization` header |
| "Network error: database error" | Server DB connection issue | Check `TB_DB_*` vars and PostgreSQL is running |
