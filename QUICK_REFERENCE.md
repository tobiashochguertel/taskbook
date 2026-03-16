# Taskbook — Quick Reference Guide

## CLI Quick Start

### Local Mode (No Server)
```bash
tb                          # Launch TUI
tb --task "Buy milk"        # Create task from CLI
tb --note "Meeting notes"   # Create note
tb --list pending           # List items by tag
```

### Server Mode (Registration)
```bash
tb --register \
  --server https://taskbook.example.com \
  --username john \
  --email john@example.com \
  --password secret123
```

### Server Mode (Login)
```bash
# Password-based
tb --login \
  --server https://taskbook.example.com \
  --username john \
  --password secret123 \
  --key <your-base64-encryption-key>

# OIDC (Browser) — opens browser automatically
tb --login-sso --server https://taskbook.example.com

# OIDC (Headless) — shows URL to open elsewhere
tb --login-sso-manual --server https://taskbook.example.com

# Token-based (from OIDC login page)
tb --set-token \
  --server https://taskbook.example.com \
  --token eyJ0eXAi... \
  --key <base64-encryption-key>
```

---

## TUI Keyboard Cheatsheet

| Key | Action |
|-----|--------|
| `1-4` | Board / Timeline / Archive / Journal |
| `j/k` or `↑/↓` | Navigate |
| `g/G` | First / Last |
| `PgDn/PgUp` | Page navigation |
| `Ctrl+D/U` | Half-page |
| `?` | Help |
| `q` | Quit |
| `Esc` | Clear filter |
| `/` or `Tab` | Command line |

### Quick Commands
| Key | Action |
|-----|--------|
| `t` | Create task |
| `n` | Create note |
| `e` | Edit item |
| `m` | Move to board |
| `p` | Set priority |
| `d` | Delete |
| `C` | Clear completed |

### Direct Actions (No Dialog)
| Key | Action |
|-----|--------|
| `c` | Toggle check |
| `b` | Toggle in-progress |
| `s` | Toggle star |
| `r` | Restore (archive only) |
| `y` | Copy to clipboard |
| `S` | Cycle sort |
| `h` | Hide completed |

---

## TUI Command Examples

### Create Items
```
/task My urgent task p:3 +work +deadline
/task @coding Fix bug in parser
/note @recipes Pasta carbonara +cooking
/task @shopping @urgent Buy groceries p:2 +errands
```

### Modify Items
```
/edit @5 Updated description here
/priority @3 1
/move @7 @"Project Alpha"
/tag @2 +urgent +frontend -backlog
/check @1 @2 @3
/star @5
/begin @1
```

### Search & Filter
```
/search urgent
/search backend
/list pending
/list +work
```

### Manage Boards
```
/rename-board @"Old Board" @"New Board"
/sort
/hide-done
```

### Server Commands
```
/sync
/force-sync
/ping
/server
/encryption-key
/reset data
```

---

## Configuration (JSON)

Location: `~/.taskbook.json`

### Minimal Setup
```json
{
  "taskbookDirectory": "~",
  "displayCompleteTasks": true,
  "displayProgressOverview": true,
  "theme": "default",
  "sync": {
    "enabled": false,
    "serverUrl": "http://localhost:8080"
  },
  "sortMethod": "id",
  "defaultView": "board"
}
```

### With Server Sync
```json
{
  "sync": {
    "enabled": true,
    "serverUrl": "https://taskbook.example.com"
  }
}
```

### Custom Theme
```json
{
  "theme": {
    "muted": { "r": 140, "g": 140, "b": 140 },
    "success": { "r": 134, "g": 239, "b": 172 },
    "warning": { "r": 253, "g": 224, "b": 71 },
    "error": { "r": 252, "g": 129, "b": 129 },
    "info": { "r": 147, "g": 197, "b": 253 },
    "pending": { "r": 216, "g": 180, "b": 254 },
    "starred": { "r": 253, "g": 224, "b": 71 }
  }
}
```

---

## Data Storage

### Local Storage (`~/.taskbook/`)
```
~/.taskbook/
├── storage.json      # Active items (encrypted)
├── archive.json      # Archived items (encrypted)
└── credentials.json  # Token + encryption key
```

### Credentials Format
```json
{
  "server_url": "https://taskbook.example.com",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "encryption_key": "s6BhdRkqt3+4..."
}
```

---

## Server REST API

### Authentication
```
POST /api/v1/register        # {username, email, password}
POST /api/v1/login           # {username, password}
POST /oauth/callback         # OIDC handler
POST /api/v1/logout          # (authenticated)
```

### Items
```
GET  /api/v1/items           # Fetch active items (encrypted)
PUT  /api/v1/items           # Save active items
GET  /api/v1/archive         # Fetch archive
PUT  /api/v1/archive         # Save archive
```

### Sync
```
GET  /api/v1/events          # SSE stream (real-time updates)
```

### User
```
GET  /api/v1/me              # Get profile
PUT  /api/v1/me              # Update profile
GET  /api/v1/encryption-key-status  # Check if key set
POST /api/v1/encryption-key  # Store key
DELETE /api/v1/encryption-key       # Reset key
```

### Health
```
GET  /health                 # Server status
```

---

## Data Model Quick Reference

### Task
```
{
  "_id": 1,
  "_date": "Mon Jan 01 2024",
  "_timestamp": 1704067200000,
  "_isTask": true,
  "description": "Buy milk",
  "isStarred": false,
  "isComplete": false,
  "inProgress": false,
  "priority": 2,
  "boards": ["shopping"],
  "tags": ["errands", "urgent"]
}
```

### Note
```
{
  "_id": 2,
  "_date": "Mon Jan 01 2024",
  "_timestamp": 1704067200000,
  "_isTask": false,
  "description": "Recipe",
  "body": "Carbonara: eggs, guanciale, pecorino",
  "isStarred": true,
  "boards": ["cooking"],
  "tags": ["pasta"]
}
```

---

## Views Comparison

| Feature | Board | Timeline | Archive | Journal |
|---------|-------|----------|---------|---------|
| Display | Boards as columns | Chronological | Deleted items | Notes only |
| Sections | Tasks/Notes/Done | All items | Archived items | Notes by date |
| Editing | Yes | Yes | No | No |
| Restore | N/A | N/A | Yes | N/A |
| Use Case | Active work | Work history | Recovery | Personal docs |

---

## Priority Levels

- **`1`** = Low (pending)
- **`2`** = Medium (warning)
- **`3`** = High (urgent/error)

---

## Theme Presets

- `default` — Standard readable
- `catppuccin-macchiato` — Cool dark
- `catppuccin-mocha` — Warm dark
- `catppuccin-frappe` — Gray dark
- `catppuccin-latte` — Light
- `high-contrast` — Accessibility

---

## Troubleshooting

### "Sync not enabled"
→ Run: `tb --login --server <url> --token <TOKEN> --key <base64>`

### "Wrong encryption key"
→ Generate new: `tb --register --server <url>` (saves key)
→ Or reset: `tb --reset-encryption-key` (loses all data)

### "Server unreachable"
→ Check URL in config: `~/.taskbook.json`
→ Test: `/ping` in TUI

### "Lost credentials"
→ Delete `~/.taskbook/credentials.json` and re-login
→ Or: `tb --logout` then `tb --login-sso`

---

## Environment Variables

None required. Configuration via:
- CLI flags
- `~/.taskbook.json`
- TUI commands

---

## Performance Notes

- **Local mode**: <100ms per operation
- **Remote mode**: Sync every operation + SSE updates
- **Encryption**: AES-256-GCM per item (negligible overhead)
- **Max items**: No hard limit (tested with 10k+ items)

---

## Supported Platforms

- Linux (x86_64, ARM64)
- macOS (x86_64, ARM64)
- Windows (WSL2 recommended)

---

## Related Documentation

- Full inventory: `FEATURE_INVENTORY.md`
- Server setup: `crates/taskbook-server/README.md`
- WebUI: `packages/taskbook-webui/README.md`
- Build: `Cargo.toml`, `Dockerfile.*`

