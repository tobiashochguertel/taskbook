# MCP OAuth Setup — Authelia SSO Integration

This guide explains how to configure the Taskbook MCP server for OAuth-based
authentication, delegating to Authelia as the identity provider.

## Overview

The MCP server implements the following OAuth standards:
- **RFC 8414** — Authorization Server Metadata Discovery
- **RFC 7591** — Dynamic Client Registration
- **RFC 9728** — Protected Resource Metadata
- **PKCE (S256)** — Proof Key for Code Exchange

When OAuth is enabled, AI agent tools (Copilot CLI, Cursor, etc.) can
authenticate automatically — no manual token configuration needed.

## Prerequisites

- Authelia instance with OIDC enabled
- Taskbook MCP server deployed with HTTP transport
- A registered OIDC client for the MCP server in Authelia

## 1. Register OIDC Client in Authelia

Add to your Authelia `configuration.yml` under `identity_providers.oidc.clients`:

```yaml
- client_id: taskbook-mcp
  client_name: Taskbook MCP Server
  client_secret: '<hashed-secret>'  # Use: authelia crypto hash generate pbkdf2 --password <secret>
  public: false
  authorization_policy: one_factor
  consent_mode: implicit
  token_endpoint_auth_method: client_secret_basic
  redirect_uris:
    - 'https://mcp-taskbook.example.com/oauth/callback'
  scopes:
    - openid
    - profile
    - email
    - offline_access
  grant_types:
    - authorization_code
    - refresh_token
  response_types:
    - code
```

Restart Authelia after adding the client.

## 2. Configure MCP Server Environment

Set these environment variables for the MCP server:

| Variable | Description | Example |
|---|---|---|
| `TB_MCP_PUBLIC_URL` | Public URL of the MCP server | `https://mcp-taskbook.example.com` |
| `TB_MCP_OAUTH_ISSUER` | Authelia OIDC issuer URL | `https://auth.example.com` |
| `TB_MCP_OAUTH_CLIENT_ID` | OIDC client ID from step 1 | `taskbook-mcp` |
| `TB_MCP_OAUTH_CLIENT_SECRET` | Plain-text client secret | `<secret>` |

All four variables must be set to enable OAuth. If any is missing, the
MCP server falls back to token-only authentication.

## 3. Update Traefik (if used)

Ensure the OAuth and well-known routes bypass Authelia's forward-auth
middleware (the MCP server handles its own OAuth):

```yaml
# Authelia access control rules
- domain: mcp-taskbook.example.com
  resources:
    - "^/mcp.*$"
    - "^/sse.*$"
    - "^/health$"
    - "^/oauth/.*$"
    - "^/\\.well-known/.*$"
  policy: bypass
```

## 4. Verify

```bash
# Check OAuth metadata
curl -s https://mcp-taskbook.example.com/.well-known/oauth-authorization-server | jq .

# Check health (should show oauth: "enabled")
curl -s https://mcp-taskbook.example.com/health | jq .

# Test dynamic client registration
curl -s -X POST https://mcp-taskbook.example.com/oauth/register \
  -H 'Content-Type: application/json' \
  -d '{"client_name":"test","redirect_uris":["http://localhost:8080/callback"]}' | jq .
```

## Authentication Methods

The MCP server supports three authentication methods (checked in order):

1. **Legacy static token** — `TB_MCP_ACCESS_TOKEN` env var (exact match)
2. **Personal Access Token** — `tb_*` prefix, verified against taskbook server
3. **OAuth access token** — verified via Authelia introspection endpoint

All methods use the `Authorization: Bearer <token>` header.

## Headless Environments

For environments without a browser (CI, SSH, scripts), use a PAT instead
of OAuth. See [Personal Access Tokens](./personal-access-tokens.md).
