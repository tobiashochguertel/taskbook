use std::path::PathBuf;
use std::process;

use clap::Parser;

mod api_client;
mod auth;
mod commands;
mod config;
mod credentials;
mod directory;
mod editor;
mod error;
mod render;
mod sso;
mod storage;
mod taskbook;
mod tui;
mod update_check;

fn version_long() -> &'static str {
    let version = env!("CARGO_PKG_VERSION");
    let hash = env!("TB_GIT_HASH");
    let branch = env!("TB_GIT_BRANCH");
    let tag = env!("TB_GIT_TAG");
    let dirty = env!("TB_GIT_DIRTY");
    let repo = env!("TB_GIT_REPO");
    let date = env!("TB_BUILD_DATE");

    let mut s = version.to_string();
    if !hash.is_empty() {
        s.push_str(&format!(" ({hash}{dirty})"));
    }
    if !branch.is_empty() {
        s.push_str(&format!("\nbranch:  {branch}"));
    }
    if !tag.is_empty() {
        s.push_str(&format!("\ntag:     {tag}"));
    }
    if !repo.is_empty() {
        s.push_str(&format!("\nrepo:    {repo}"));
    }
    if !date.is_empty() {
        s.push_str(&format!("\nbuilt:   {date}"));
    }
    Box::leak(s.into_boxed_str())
}

const EXAMPLES_TEXT: &str = r#"
  Examples
    $ tb                          Display board view (TUI)
    $ tb --task Make breakfast    Create a task
    $ tb --note @ideas Remember  Create a note on the "ideas" board
    $ tb --check 1 2             Check/uncheck tasks 1 and 2
    $ tb --begin 3               Start/pause task 3
    $ tb --edit @3 Fix typo      Edit item 3's description
    $ tb --move @1 cooking       Move item 1 to "cooking" board
    $ tb --priority @3 2         Set task 3 priority to 2
    $ tb --tag @3 +urgent        Add "urgent" tag to item 3
    $ tb --find documentation    Search for "documentation"
    $ tb --list +urgent          List items tagged "urgent"
    $ tb --login-sso             Log in via browser SSO
    $ tb --tokens                List personal access tokens
    $ tb --create-token ci       Create a token named "ci"
    $ tb --status                Show sync status
"#;

#[derive(Parser)]
#[command(
    name = "tb",
    version = env!("CARGO_PKG_VERSION"),
    long_version = version_long(),
    about = "Tasks, boards & notes for the command-line habitat",
    after_help = EXAMPLES_TEXT
)]
struct Cli {
    /// Input arguments (task description, IDs, search terms, etc.)
    #[arg(trailing_var_arg = true)]
    input: Vec<String>,

    // ── Item Actions ─────────────────────────────────────────────────
    /// Create task
    #[arg(short = 't', long, help_heading = "Item Actions")]
    task: bool,

    /// Create note
    #[arg(short = 'n', long, help_heading = "Item Actions")]
    note: bool,

    /// Check/uncheck task
    #[arg(short = 'c', long, help_heading = "Item Actions")]
    check: bool,

    /// Start/pause task
    #[arg(short = 'b', long, help_heading = "Item Actions")]
    begin: bool,

    /// Delete item
    #[arg(short = 'd', long, help_heading = "Item Actions")]
    delete: bool,

    /// Edit item description
    #[arg(short = 'e', long, help_heading = "Item Actions")]
    edit: bool,

    /// Edit note in external editor
    #[arg(long, help_heading = "Item Actions")]
    edit_note: bool,

    /// Move item between boards
    #[arg(short = 'm', long, help_heading = "Item Actions")]
    r#move: bool,

    /// Update priority of task
    #[arg(short = 'p', long, help_heading = "Item Actions")]
    priority: bool,

    /// Star/unstar item
    #[arg(short = 's', long, help_heading = "Item Actions")]
    star: bool,

    /// Add or remove tags on an item
    #[arg(long, help_heading = "Item Actions")]
    tag: bool,

    /// Copy item description to clipboard
    #[arg(short = 'y', long, help_heading = "Item Actions")]
    copy: bool,

    // ── View & Search ────────────────────────────────────────────────
    /// Display archived items
    #[arg(short = 'a', long, help_heading = "View & Search")]
    archive: bool,

    /// Search for items
    #[arg(short = 'f', long, help_heading = "View & Search")]
    find: bool,

    /// List items by attributes
    #[arg(short = 'l', long, help_heading = "View & Search")]
    list: bool,

    /// Display timeline view
    #[arg(short = 'i', long, help_heading = "View & Search")]
    timeline: bool,

    /// Restore items from archive
    #[arg(short = 'r', long, help_heading = "View & Search")]
    restore: bool,

    /// Delete all checked items
    #[arg(long, help_heading = "View & Search")]
    clear: bool,

    // ── Authentication ───────────────────────────────────────────────
    /// Register a new server account
    #[arg(long, help_heading = "Authentication")]
    register: bool,

    /// Log in to an existing server account
    #[arg(long, help_heading = "Authentication")]
    login: bool,

    /// Log in via browser-based SSO (OIDC) — opens browser
    #[arg(long, help_heading = "Authentication")]
    login_sso: bool,

    /// Log in via SSO for headless/remote hosts — shows URL to open on any device
    #[arg(long, help_heading = "Authentication")]
    login_sso_manual: bool,

    /// Log out and delete credentials
    #[arg(long, help_heading = "Authentication")]
    logout: bool,

    /// Save a session token directly (e.g. from OIDC browser login)
    #[arg(long, help_heading = "Authentication")]
    set_token: bool,

    /// Session token value (for --set-token or --login)
    #[arg(long, help_heading = "Authentication")]
    token: Option<String>,

    /// Server URL for register/login
    #[arg(long, help_heading = "Authentication")]
    server: Option<String>,

    /// Username for register/login
    #[arg(long, help_heading = "Authentication")]
    username: Option<String>,

    /// Email for register
    #[arg(long, help_heading = "Authentication")]
    email: Option<String>,

    /// Password for register/login
    #[arg(long, help_heading = "Authentication")]
    password: Option<String>,

    /// Encryption key (base64) for login
    #[arg(long, help_heading = "Authentication")]
    key: Option<String>,

    // ── User Profile & Tokens ────────────────────────────────────────
    /// Show sync status and connection info
    #[arg(long, help_heading = "User Profile & Tokens")]
    status: bool,

    /// List Personal Access Tokens
    #[arg(long, help_heading = "User Profile & Tokens")]
    tokens: bool,

    /// Create a new Personal Access Token
    #[arg(long, help_heading = "User Profile & Tokens")]
    create_token: Option<String>,

    /// Revoke a Personal Access Token by name or ID
    #[arg(long, help_heading = "User Profile & Tokens")]
    revoke_token: Option<String>,

    /// Reset encryption key (WARNING: deletes all encrypted data)
    #[arg(long, help_heading = "User Profile & Tokens")]
    reset_encryption_key: bool,

    // ── General ──────────────────────────────────────────────────────
    /// Push local data to server
    #[arg(long, help_heading = "General")]
    migrate: bool,

    /// Define a custom taskbook directory
    #[arg(long = "taskbook-dir", value_name = "PATH", help_heading = "General")]
    taskbook_dir: Option<PathBuf>,

    /// Run in CLI mode (non-interactive)
    #[arg(long, help_heading = "General")]
    cli: bool,
}

fn main() {
    let cli = Cli::parse();

    // Check for updates in background (non-blocking, once per 24h)
    update_check::check_for_updates();

    // Handle server commands first (interactive prompts for missing values)
    if cli.register {
        if let Err(e) = auth::register(
            cli.server.as_deref(),
            cli.username.as_deref(),
            cli.email.as_deref(),
            cli.password.as_deref(),
        ) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.login {
        if let Err(e) = auth::login(
            cli.server.as_deref(),
            cli.username.as_deref(),
            cli.password.as_deref(),
            cli.key.as_deref(),
            cli.token.as_deref(),
        ) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.login_sso {
        if let Err(e) = auth::login_sso(cli.server.as_deref(), cli.key.as_deref()) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.login_sso_manual {
        if let Err(e) = auth::login_sso_manual(cli.server.as_deref(), cli.key.as_deref()) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.set_token {
        if let Err(e) = auth::set_token(
            cli.server.as_deref(),
            cli.token.as_deref(),
            cli.key.as_deref(),
        ) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.logout {
        if let Err(e) = auth::logout() {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.status {
        if let Err(e) = auth::status() {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.reset_encryption_key {
        if let Err(e) = auth::reset_encryption_key() {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.tokens {
        if let Err(e) = auth::list_tokens() {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if let Some(ref name) = cli.create_token {
        if let Err(e) = auth::create_token(name) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if let Some(ref name_or_id) = cli.revoke_token {
        if let Err(e) = auth::revoke_token(name_or_id) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    if cli.migrate {
        if let Err(e) = commands::migrate(cli.taskbook_dir) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    // Determine if we should run TUI or CLI mode
    let has_action_flags = cli.archive
        || cli.task
        || cli.note
        || cli.check
        || cli.begin
        || cli.star
        || cli.delete
        || cli.restore
        || cli.edit
        || cli.edit_note
        || cli.r#move
        || cli.priority
        || cli.copy
        || cli.find
        || cli.list
        || cli.clear
        || cli.timeline
        || cli.tag;

    // Run TUI if: no action flags, no CLI flag, and no input
    let run_tui = !cli.cli && !has_action_flags && cli.input.is_empty();

    if run_tui {
        // Run interactive TUI
        if let Err(e) = tui::run(cli.taskbook_dir.as_deref()) {
            eprintln!("TUI error: {}", e);
            process::exit(1);
        }
    } else {
        // Run CLI mode
        let result = commands::run(
            cli.input,
            cli.archive,
            cli.task,
            cli.restore,
            cli.note,
            cli.delete,
            cli.check,
            cli.begin,
            cli.star,
            cli.priority,
            cli.copy,
            cli.timeline,
            cli.find,
            cli.list,
            cli.edit,
            cli.edit_note,
            cli.r#move,
            cli.clear,
            cli.tag,
            cli.taskbook_dir,
        );

        if let Err(e) = result {
            eprintln!("{}", e);
            process::exit(1);
        }
    }
}
