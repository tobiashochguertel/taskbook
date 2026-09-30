---
title: Personal Access Tokens
description: Create and manage long-lived API tokens for taskbook
---

# Personal Access Tokens

Personal Access Tokens (PATs) are long-lived API keys you can use to authenticate
with the taskbook API, MCP server, and CLI without a browser session.

## Overview

| Property     | Details                                      |
| ------------ | -------------------------------------------- |
| Format       | `tb_<base64url-encoded-random-bytes>` (~49 chars) |
| Storage      | Only SHA-256 hash stored server-side         |
| Expiry       | Optional (1–3650 days, or never)             |
| Scopes       | Full access (same as session token)          |
| Revocation   | Instant — via WebUI, CLI, or API             |

## Creating Tokens

### WebUI

1. Navigate to `/profile` (click the user icon in the top bar)
2. Click **+ New Token**
3. Enter a name (e.g., `copilot-cli`) and optional expiry
4. Copy the token immediately — it will not be shown again

### CLI

```bash
# Create a token
tb --create-token "my-mcp-key"

# List all tokens
tb --tokens

# Revoke by name
tb --revoke-token "my-mcp-key"

# Revoke by UUID
tb --revoke-token "550e8400-e29b-41d4-a716-446655440000"
```

### API

```bash
# Create
curl -X POST https://taskbook.example.com/api/v1/me/tokens \
  -H "Authorization: Bearer <session-or-pat>" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-pipeline", "expires_in_days": 90}'

# List
curl https://taskbook.example.com/api/v1/me/tokens \
  -H "Authorization: Bearer <session-or-pat>"

# Revoke
curl -X DELETE https://taskbook.example.com/api/v1/me/tokens/<token-uuid> \
  -H "Authorization: Bearer <session-or-pat>"
```

## Using PATs

### In MCP Server Config

Set the `TB_TOKEN` environment variable to your PAT:

```json
{
  "taskbook": {
    "type": "http",
    "url": "https://mcp-taskbook.example.com/mcp",
    "headers": {
      "Authorization": "Bearer tb_your-token-here"
    }
  }
}
```

Or use the environment variable approach:

```bash
export TB_TOKEN="tb_your-token-here"
```

### In CLI (headless / CI)

```bash
tb --set-token --server https://taskbook.example.com --token "tb_your-token-here"
```

## Security

- **Tokens are shown once** at creation. Store them securely.
- **Only SHA-256 hashes** are stored in the database — raw tokens cannot be recovered.
- **Revoke immediately** if a token is compromised.
- Tokens with the `tb_` prefix enable automated secret scanning.
- `last_used_at` is tracked for audit purposes.
