# Taskbook Rust Fork — Comprehensive Feature Inventory

## 1. CLI FLAGS & OPTIONS (from `crates/taskbook-client/src/main.rs`)

### Display & Navigation
- **`--archive` / `-a`** — Display archived items
- **`--timeline` / `-i`** — Display timeline view
- No flags — Display board view (TUI interactive mode)

### Item Management
- **`--task` / `-t` <description>** — Create task
- **`--note` / `-n` <description>** — Create note (opens editor if no description)
- **`--check` / `-c` <ids>** — Check/uncheck task(s)
- **`--begin` / `-b` <ids>** — Start/pause task(s) (in-progress toggle)
- **`--priority` / `-p` <id> <1-3>** — Update task priority (1-3)
- **`--star` / `-s` <ids>** — Star/unstar items
- **`--delete` / `-d` <ids>** — Delete items
- **`--edit` / `-e` @<id> <new-description>** — Edit item description
- **`--edit-note`** — Edit note in external editor
- **`--restore` / `-r` <ids>** — Restore items from archive
- **`--move` / `-m` @<id> @<board>** — Move item between boards
- **`--tag`** — Add/remove tags on items (format: +tag to add, -tag to remove)
- **`--clear`** — Delete all checked/completed items
- **`--copy` / `-y` <ids>** — Copy item description to clipboard
- **`--find` / `-f` <search-term>** — Search for items

### Server/Auth Commands
- **`--register`** — Register new server account
  - Params: `--server <url>`, `--username <user>`, `--email <email>`, `--password <pass>`
- **`--login`** — Log in to server (password-based)
  - Params: `--server <url>`, `--username <user>`, `--password <pass>`, `--key <base64>`
  - Or use: `--token <TOKEN>` instead of password
- **`--login-sso`** — Log in via browser SSO (OIDC) — opens browser automatically
  - Params: `--server <url>`, `--key <base64>` (optional)
- **`--login-sso-manual`** — Log in via SSO for headless/remote hosts (shows URL to open elsewhere)
  - Params: `--server <url>`, `--key <base64>` (optional)
- **`--set-token`** — Save session token directly (from OIDC login)
  - Params: `--server <url>`, `--token <TOKEN>`, `--key <base64>`
- **`--logout`** — Log out and delete credentials
- **`--status`** — Show sync status (local vs remote mode)
- **`--migrate`** — Push local data to server
- **`--reset-encryption-key`** — Reset encryption key (WARNING: deletes all data)

### System Flags
- **`--taskbook-dir` <PATH>** — Define custom taskbook directory
- **`--cli`** — Force CLI mode (non-interactive) instead of TUI
- **`--help` / `-h`** — Display help message
- **`--version` / `-v`** — Display installed version

---

## 2. TUI SLASH COMMANDS (from `crates/taskbook-client/src/tui/command_parser.rs`)

### Item Operations
- **`/task [@<board>] <description> [p:1-3] [+tag1 +tag2]`** — Create task
  - Optional: `@board` name, priority `p:1-3`, tags with `+tag`
- **`/note [@<board>] <title> [+tag1 +tag2]`** — Create note
  - Optional: `@board` name, tags with `+tag`
- **`/edit @<id> <new-description>`** — Edit item description
- **`/move @<id> @<board>`** — Move item to board
- **`/delete @<id1> @<id2> ...`** — Delete item(s)
- **`/check @<id1> @<id2> ...`** — Toggle check status
- **`/begin @<id1> @<id2> ...`** — Toggle in-progress status
- **`/star @<id1> @<id2> ...`** — Toggle starred status
- **`/tag @<id> +tag1 +tag2 -tag3 -tag4`** — Add/remove tags
- **`/priority @<id> <1-3>`** — Set priority
- **`/clear`** — Delete all completed items (requires confirmation)
- **`/search <term>`** — Search for items

### Board Management
- **`/rename-board @"old name" @"new name"`** — Rename board (supports quoted board names)

### View Switching
- **`/board`** — Switch to board view
- **`/timeline`** — Switch to timeline view
- **`/archive`** — Switch to archive view
- **`/journal`** — Switch to journal view

### Filtering & Sorting
- **`/sort`** — Cycle sort method (ID → Priority → Status → ID)
- **`/hide-done`** — Toggle hiding completed tasks

### Sync & Server
- **`/sync`** / **`/refresh`** — Sync with server
- **`/force-sync`** — Clear cache and force full sync
- **`/ping`** — Test server connectivity
- **`/server`** — Show server connection status
- **`/status`** — Show sync mode (local/remote) and server URL
- **`/encryption-key`** — Show encryption key status
- **`/encryption-key set <base64-key>`** — Set encryption key
- **`/reset credentials|data|all`** — Reset credentials, data, or both (requires confirmation)

### Other
- **`/help`** — Show help popup
- **`/quit`** / **`/q`** — Exit TUI

---

## 3. TUI KEYBOARD SHORTCUTS (from `crates/taskbook-client/src/tui/actions.rs`)

### Navigation
- **`j` / `↓`** — Move down
- **`k` / `↑`** — Move up
- **`g`** — Jump to first item
- **`G`** — Jump to last item
- **`PgDn`** — Page down
- **`PgUp`** — Page up
- **`Ctrl+D`** — Half-page down
- **`Ctrl+U`** — Half-page up

### View Switching
- **`1`** — Board view
- **`2`** — Timeline view
- **`3`** — Archive view
- **`4`** — Journal view
- **`?`** — Help popup
- **`q`** — Quit application
- **`Esc`** — Clear search/filter

### Command Line
- **`/` / `Tab`** — Activate command line (toggle)
- **`Up/Down`** — Browse command history (when focused) or navigate suggestions
- **`Tab`** — Accept selected suggestion
- **`Enter`** — Execute command
- **`Esc`** — Cancel command

### Quick Commands (Pre-fill shortcuts)
- **`t`** — Create task (`/task @<board> `)
- **`n`** — Create note (`/note @<board> `)
- **`e`** — Edit selected item (`/edit @<id> <current-desc>`)
- **`m`** — Move item (`/move @<id> @`)
- **`p`** — Set priority (`/priority @<id> `)
- **`d`** — Delete item (with confirmation)
- **`C`** — Clear all completed (with confirmation)

### Direct Actions
- **`c`** — Toggle check (mark complete)
- **`b`** — Toggle begin (in-progress)
- **`s`** — Toggle star
- **`r`** — Restore item (Archive view only)
- **`y`** — Copy item description to clipboard
- **`S`** — Cycle sort method (Board view only)
- **`h`** — Toggle hide completed tasks

### Mouse Support
- **Left click** — Select item (double-click on note = edit in external editor)
- **Scroll up/down** — Navigate items

---

## 4. DATA MODEL (from `crates/taskbook-common/src/`)

### Item Type (Trait)
```
trait Item {
  fn id() -> u64
  fn date() -> &str
  fn timestamp() -> i64
  fn description() -> &str
  fn is_starred() -> bool
  fn boards() -> &[String]
  fn tags() -> &[String]
  fn is_task() -> bool
}
```

### Task
- **`_id: u64`** — Unique identifier
- **`_date: String`** — Creation date (formatted, e.g., "Mon Jan 01 2024")
- **`_timestamp: i64`** — Millisecond timestamp
- **`_isTask: bool`** — Always `true`
- **`description: String`** — Task title/description
- **`isStarred: bool`** — Starred flag
- **`isComplete: bool`** — Completion status
- **`inProgress: bool`** — In-progress/started status
- **`priority: u8`** — Priority level (1-3, clamped automatically)
- **`boards: Vec<String>`** — Board assignments (can be multiple)
- **`tags: Vec<String>`** — Associated tags (optional)

### Note
- **`_id: u64`** — Unique identifier
- **`_date: String`** — Creation date
- **`_timestamp: i64`** — Millisecond timestamp
- **`_isTask: bool`** — Always `false`
- **`description: String`** — Note title
- **`body: Option<String>`** — Rich note content (optional, skip if empty)
- **`isStarred: bool`** — Starred flag
- **`boards: Vec<String>`** — Board assignments
- **`tags: Vec<String>`** — Associated tags (optional)

### StorageItem (Enum)
- `Task(Task)` — Task variant
- `Note(Note)` — Note variant

---

## 5. STORAGE BACKENDS (from `crates/taskbook-client/src/storage/`)

### StorageBackend Trait
Two implementations abstracted by trait:
```
trait StorageBackend {
  fn get(&self) -> Result<HashMap<String, StorageItem>>  // Active items
  fn get_archive(&self) -> Result<HashMap<String, StorageItem>>  // Archived items
  fn set(&self, data: &HashMap<String, StorageItem>) -> Result<()>  // Save active
  fn set_archive(&self, data: &HashMap<String, StorageItem>) -> Result<()>  // Save archive
}
```

### LocalStorage
- **Storage**: JSON files in `~/.taskbook/` directory
- **Files**:
  - `storage.json` — Active items
  - `archive.json` — Archived items
- **Encryption**: Client-side encryption via `taskbook_common::encryption`
- **Sync**: Optional, disabled by default

### RemoteStorage
- **Storage**: Remote Taskbook server (HTTP/REST)
- **Endpoints**:
  - `GET /api/v1/items` — Fetch encrypted items
  - `PUT /api/v1/items` — Save encrypted items
  - `GET /api/v1/archive` — Fetch archived items
  - `PUT /api/v1/archive` — Save archived items
- **Encryption**: Client-side AES-256-GCM, server stores encrypted blobs
- **Format**: Base64-encoded encrypted data + nonce
- **Auth**: Bearer token (JWT)

---

## 6. SERVER FEATURES (from `crates/taskbook-server/src/`)

### Core Endpoints

#### Authentication
- **`POST /api/v1/register`** — Register new account
  - Request: `{username, email, password}`
  - Response: `{token}`
  - Validation: Username (1-64 chars), Password (8-1024 chars)
  - Rate limited

- **`POST /api/v1/login`** — Login with credentials
  - Request: `{username, password}`
  - Response: `{token}`
  - Rate limited

- **`POST /oauth/callback`** (OIDC)
  - Handles OIDC authentication (Authelia, Keycloak, etc.)
  - Auto-provisions users from OIDC provider
  - Supports redirect URIs for SPA

- **`POST /api/v1/logout`** — Logout (clears session)
  - Authenticated

- **`GET /api/v1/me`** — Get current user info
  - Response: `{username, email}`
  - Authenticated

- **`PUT /api/v1/me`** — Update user profile
  - Request: `{username?}`
  - Response: `{username, email}`
  - Authenticated

#### Items (Encrypted Sync)
- **`GET /api/v1/items`** — Fetch active items
  - Response: `{items: {key: {data: base64, nonce: base64}}}`
  - Authenticated
  - User-scoped

- **`PUT /api/v1/items`** — Replace active items
  - Request: `{items: {key: {data: base64, nonce: base64}}}`
  - Triggers SSE `DataChanged` event
  - Authenticated

- **`GET /api/v1/archive`** — Fetch archived items
  - Same format as items
  - Authenticated
  - User-scoped

- **`PUT /api/v1/archive`** — Replace archived items
  - Triggers SSE `DataChanged` event
  - Authenticated

#### Encryption Keys
- **`GET /api/v1/encryption-key-status`** — Check if user has encryption key set
  - Response: `{has_key: bool}`
  - Authenticated

- **`POST /api/v1/encryption-key`** — Store encryption key hash
  - Request: `{encryption_key: base64}`
  - Authenticated

- **`DELETE /api/v1/encryption-key`** — Reset/delete encryption key
  - Authenticated

#### Real-time Sync
- **`GET /api/v1/events`** — Server-Sent Events (SSE) stream
  - Authenticated
  - Events: `DataChanged {archived: bool}` — triggers client refresh
  - Keep-alive: 15-second interval
  - Metrics tracked: active connections gauge

#### Health & Status
- **`GET /`** / **`GET /health`** — Health check
  - Returns server info: version, OIDC enabled, built-in UI version
  - No authentication required

### Database Schema
- **Users table**: `id (UUID), username, email, password_hash, created_at`
- **Sessions table**: `id (UUID), user_id, token, expires_at`
- **Items table**: `user_id, item_key, data (blob), nonce (blob), archived`
- **OIDC Identities**: `user_id, provider, subject` — Maps OIDC providers to users
- **Encryption Keys**: `user_id, encryption_key_hash` — Stores hashed keys

### Authentication Methods
1. **Password-based** (username/password)
2. **OIDC/SSO** (OpenID Connect federation)
   - Automatic user provisioning
   - Email and preferred_username from OIDC claims
   - Unique username generation if needed
   - Secure redirect URI validation

### Security Features
- **Rate limiting**: Auth endpoints (register, login) — IP-based
- **Encryption**: AES-256-GCM client-side (server never sees plaintext)
- **Password**: bcrypt hashing (never stored in plaintext)
- **Sessions**: JWT tokens with configurable expiry
- **CORS**: Configurable cross-origin requests
- **Metrics**: Prometheus metrics for monitoring

---

## 7. CONFIGURATION (from `crates/taskbook-client/src/config.rs`)

### Config File Location
- **`~/.taskbook.json`** — JSON configuration

### Configuration Options
```json
{
  "taskbookDirectory": "~/.taskbook",
  "displayCompleteTasks": true,
  "displayProgressOverview": true,
  "theme": "default | <preset-name> | {custom colors}",
  "sync": {
    "enabled": false,
    "serverUrl": "http://localhost:8080"
  },
  "sortMethod": "id | priority | status",
  "defaultView": "board | timeline | archive | journal"
}
```

### Theme Presets
- **`default`** — Standard readable palette
- **`catppuccin-macchiato`** — Cool dark theme
- **`catppuccin-mocha`** — Warm dark theme
- **`catppuccin-frappe`** — Gray dark theme
- **`catppuccin-latte`** — Light theme
- **`high-contrast`** — Accessibility-focused

### Theme Colors (Customizable)
- `muted` — Secondary text
- `success` — Completed/checkmarks
- `warning` — In-progress/medium priority
- `error` — High priority
- `info` — Notes/counters
- `pending` — Pending tasks
- `starred` — Starred items

### Sort Methods
- **`Id`** — By creation order (default)
- **`Priority`** — By priority (high first), then ID
- **`Status`** — By status (pending → in-progress → done), then ID

---

## 8. WebUI FEATURES (from `packages/taskbook-webui/src/`)

### Routes
- **`/login`** — Authentication page (handles token, OIDC callback)
- **`/`** (Board) — Main task/note management interface

### Pages/Components

#### Board Page
- **Task section**: Active tasks (uncompleted)
- **Notes section**: All notes
- **Done section**: Completed tasks (collapsible)
- **Board filtering**: Dropdown to select board
- **Command palette**: `Ctrl+K` or `/` to execute commands
- **Settings dialog**: Theme, sync status, encryption key

#### UI Components
- **`task-card.tsx`** — Individual task/note rendering
  - Check/star/delete buttons
  - Priority badges
  - Tag display
  - Double-click to edit note in external editor

- **`create-item-sheet.tsx`** — Create task/note modal
  - Title/description input
  - Board selection
  - Priority selector
  - Tag input

- **`command-palette.tsx`** — Command/search interface
  - Real-time search across items
  - Create commands (`/task`, `/note`)
  - Navigation

- **`settings-dialog.tsx`** — Configuration UI
  - Theme selector
  - Server connection status
  - Encryption key management
  - Logout button

- **`connection-indicator.tsx`** — SSE sync status
  - Connected/disconnected indicator
  - Last sync time
  - Sync error display

- **`mobile-tabs.tsx`** — Mobile navigation
  - Tasks, Notes, Done, Archive tabs

- **`fab.tsx`** — Floating action button (mobile)

### Hooks
- **`useItems()`** — Fetch and manage active items + sync
- **`useArchive()`** — Fetch and manage archived items
- **`useUser()`** — Get logged-in user info
- **`useEventSync()`** — Subscribe to SSE events for real-time updates
- **`useConnectionStatus()`** — Monitor server connection state

### Authentication
- **Token-based**: JWT token in localStorage
- **Encryption key**: Stored separately
- **OIDC callback**: Parses token + encryption_key from hash
- **Session persistence**: Auto-login if token valid

### Data Flow
1. User logs in → Token + Encryption Key stored
2. Items fetched from server (encrypted)
3. Client decrypts using encryption key
4. SSE connection opened → real-time updates
5. Any mutation (create/edit/delete) → PUT to server
6. Server broadcasts DataChanged event → all clients refresh

---

## 9. VIEWS

### Board View
- **Layout**: Multiple columns (one per board)
- **Sections per board**: Tasks (active) | Notes | Done (completed)
- **Filtering**: By board name (click to filter)
- **Sorting**: By ID, Priority, or Status
- **Hide completed**: Toggle to hide done tasks
- **Mobile**: Single board at a time + tab navigation

### Timeline View
- **Chronological display**: Items ordered by creation date
- **Focus**: Task progress over time
- **Use case**: See work history

### Archive View
- **Deleted/archived items**: Separate storage
- **Restore action**: Move items back to active
- **Immutable**: Can't edit archived items (must restore first)

### Journal View
- **Note-centric view**: Focus on note collection
- **Chronological**: Notes ordered by date
- **Rich content**: Display note titles + bodies
- **Use case**: Personal journal/knowledge base

---

## 10. AUTHENTICATION

### Password-Based Auth (CLI)
```bash
tb --register --server <url> --username <u> --email <e> --password <p>
tb --login --server <url> --username <u> --password <p> --key <base64-key>
```

### OIDC/SSO (Browser)
```bash
tb --login-sso --server <url> --key <base64-key>
  # Opens browser → OIDC provider → redirects with token
  # Client extracts token from URL hash
```

### OIDC/SSO (Headless/Remote)
```bash
tb --login-sso-manual --server <url> --key <base64-key>
  # Displays URL to open on any device
  # Polls for completion
```

### Direct Token
```bash
tb --set-token --server <url> --token <TOKEN> --key <base64-key>
  # Skip OIDC flow, use pre-obtained token
```

### Credentials Management
- **File**: `~/.taskbook/credentials.json`
- **Contains**: `token`, `server_url`, `encryption_key` (base64)
- **Deletion**: `tb --logout` or `/reset credentials`

### Encryption Key Management
- **Generation**: Random 256-bit (32 bytes) on registration/new OIDC user
- **Format**: Base64-encoded
- **Storage**: Credentials file (client-side)
- **Server**: Never sees plaintext key; only encrypted items
- **Reset**: `tb --reset-encryption-key` (WARNING: loses all data)
- **Sharing**: Key required to access account on different device

### OIDC Provider Support
- **Authelia**
- **Keycloak**
- **Any OpenID Connect provider**
- **Features**:
  - Automatic user provisioning
  - Email + preferred_username claims
  - Redirect URI validation
  - Fallback username generation

---

## Summary Statistics

| Category | Count |
|----------|-------|
| CLI Flags/Options | 41 |
| TUI Slash Commands | 27 |
| Keyboard Shortcuts | 35+ |
| Server Endpoints | 13 |
| Storage Backends | 2 (Local + Remote) |
| Views | 4 (Board, Timeline, Archive, Journal) |
| Authentication Methods | 4 (Password, OIDC Browser, OIDC Manual, Token) |
| Theme Presets | 5 + custom |
| Data Types | 2 (Task, Note) |

