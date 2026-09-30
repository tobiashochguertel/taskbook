use std::io;
use std::path::PathBuf;
use std::process;

use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::{generate, Shell};

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
    $ tb                           Launch interactive TUI
    $ tb task Buy groceries        Create a task
    $ tb note @ideas Remember      Create a note on "ideas" board
    $ tb task check 1 2            Check/uncheck tasks 1 and 2
    $ tb task begin 3              Start/pause task 3
    $ tb task edit @3 Fix typo     Edit item 3's description
    $ tb task move @1 cooking      Move item 1 to "cooking" board
    $ tb task priority @3 2        Set task 3 priority to 2
    $ tb task tag @3 +urgent       Add "urgent" tag to item 3
    $ tb find documentation        Search for "documentation"
    $ tb list +urgent              List items tagged "urgent"
    $ tb auth login-sso            Log in via browser SSO
    $ tb token list                List personal access tokens
    $ tb token create ci           Create a token named "ci"
    $ tb auth status               Show sync status
"#;

// ─── Top-level CLI ──────────────────────────────────────────────────────

#[derive(Parser)]
#[command(
    name = "tb",
    version = env!("CARGO_PKG_VERSION"),
    long_version = version_long(),
    about = "Tasks, boards & notes for the command-line habitat",
    after_help = EXAMPLES_TEXT
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Custom taskbook directory
    #[arg(long = "taskbook-dir", value_name = "PATH", global = true)]
    taskbook_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create and manage tasks
    #[command(alias = "t")]
    Task(TaskArgs),

    /// Create and manage notes
    #[command(alias = "n")]
    Note(NoteArgs),

    /// Search for items
    #[command(alias = "f")]
    Find {
        /// Search terms
        #[arg(required = true)]
        query: Vec<String>,
    },

    /// List items by attributes
    #[command(alias = "ls")]
    List {
        /// Filter attributes (board names, +tags, etc.)
        filter: Vec<String>,
    },

    /// Display timeline view
    Timeline,

    /// Manage archived items
    Archive(ArchiveArgs),

    /// Authentication and server connection
    Auth(AuthArgs),

    /// Manage Personal Access Tokens
    Token(TokenArgs),

    /// Sync operations
    Sync(SyncArgs),

    /// Generate shell completions
    Completions {
        /// Shell to generate completions for
        shell: Shell,
    },
}

// ─── Task subcommands ───────────────────────────────────────────────────

#[derive(Parser)]
struct TaskArgs {
    #[command(subcommand)]
    action: Option<TaskAction>,

    /// Task description (shorthand for `tb task create <desc>`)
    #[arg(trailing_var_arg = true)]
    input: Vec<String>,
}

#[derive(Subcommand)]
enum TaskAction {
    /// Create a new task
    Create {
        /// Task description (@board prefix, +tag suffix supported)
        #[arg(required = true, trailing_var_arg = true)]
        description: Vec<String>,
    },
    /// Check/uncheck tasks
    Check {
        /// Item IDs to check/uncheck
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Start/pause tasks
    Begin {
        /// Item IDs to start/pause
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Delete items
    Delete {
        /// Item IDs to delete
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Edit item description
    Edit {
        /// @ID and new description
        #[arg(required = true, trailing_var_arg = true)]
        input: Vec<String>,
    },
    /// Edit note content in external editor
    EditNote {
        /// @ID of the note to edit
        #[arg(required = true, trailing_var_arg = true)]
        input: Vec<String>,
    },
    /// Move item to another board
    Move {
        /// @ID and target board name(s)
        #[arg(required = true, trailing_var_arg = true)]
        input: Vec<String>,
    },
    /// Set task priority (1=normal, 2=medium, 3=high)
    Priority {
        /// @ID and priority level
        #[arg(required = true, trailing_var_arg = true)]
        input: Vec<String>,
    },
    /// Star/unstar items
    Star {
        /// Item IDs to star/unstar
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Add or remove tags
    Tag {
        /// @ID and +tag/-tag arguments
        #[arg(required = true, trailing_var_arg = true)]
        input: Vec<String>,
    },
    /// Copy item description to clipboard
    Copy {
        /// Item IDs to copy
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Delete all checked items
    Clear,
}

// ─── Note subcommands ───────────────────────────────────────────────────

#[derive(Parser)]
struct NoteArgs {
    #[command(subcommand)]
    action: Option<NoteAction>,

    /// Note description (shorthand for `tb note create <desc>`)
    #[arg(trailing_var_arg = true)]
    input: Vec<String>,
}

#[derive(Subcommand)]
enum NoteAction {
    /// Create a new note
    Create {
        /// Note description (@board prefix, +tag suffix supported)
        #[arg(trailing_var_arg = true)]
        description: Vec<String>,
    },
}

// ─── Archive subcommands ────────────────────────────────────────────────

#[derive(Parser)]
struct ArchiveArgs {
    #[command(subcommand)]
    action: Option<ArchiveAction>,
}

#[derive(Subcommand)]
enum ArchiveAction {
    /// Show archived items
    Show,
    /// Restore items from archive
    Restore {
        /// Item IDs to restore
        #[arg(required = true)]
        ids: Vec<String>,
    },
    /// Delete all checked items (archive them)
    Clear,
}

// ─── Auth subcommands ───────────────────────────────────────────────────

#[derive(Parser)]
struct AuthArgs {
    #[command(subcommand)]
    action: AuthAction,
}

#[derive(Subcommand)]
enum AuthAction {
    /// Register a new server account
    Register {
        /// Server URL
        #[arg(long)]
        server: Option<String>,
        /// Username
        #[arg(long)]
        username: Option<String>,
        /// Email address
        #[arg(long)]
        email: Option<String>,
        /// Password
        #[arg(long)]
        password: Option<String>,
    },
    /// Log in with username and password
    Login {
        /// Server URL
        #[arg(long)]
        server: Option<String>,
        /// Username
        #[arg(long)]
        username: Option<String>,
        /// Password
        #[arg(long)]
        password: Option<String>,
        /// Encryption key (base64)
        #[arg(long)]
        key: Option<String>,
        /// Session token
        #[arg(long)]
        token: Option<String>,
    },
    /// Log in via browser-based SSO (OIDC)
    #[command(name = "login-sso")]
    LoginSso {
        /// Server URL
        #[arg(long)]
        server: Option<String>,
        /// Encryption key (base64)
        #[arg(long)]
        key: Option<String>,
    },
    /// Log in via SSO for headless/remote hosts
    #[command(name = "login-sso-manual")]
    LoginSsoManual {
        /// Server URL
        #[arg(long)]
        server: Option<String>,
        /// Encryption key (base64)
        #[arg(long)]
        key: Option<String>,
    },
    /// Save a session token directly
    #[command(name = "set-token")]
    SetToken {
        /// Server URL
        #[arg(long)]
        server: Option<String>,
        /// Session token
        #[arg(long)]
        token: Option<String>,
        /// Encryption key (base64)
        #[arg(long)]
        key: Option<String>,
    },
    /// Log out and delete credentials
    Logout,
    /// Show sync status and connection info
    Status,
    /// Reset encryption key (WARNING: deletes all encrypted data)
    #[command(name = "reset-key")]
    ResetKey,
}

// ─── Token subcommands ──────────────────────────────────────────────────

#[derive(Parser)]
struct TokenArgs {
    #[command(subcommand)]
    action: TokenAction,
}

#[derive(Subcommand)]
enum TokenAction {
    /// List Personal Access Tokens
    #[command(alias = "ls")]
    List,
    /// Create a new Personal Access Token
    Create {
        /// Token name
        name: String,
    },
    /// Revoke a Personal Access Token
    Revoke {
        /// Token name or ID
        name_or_id: String,
    },
}

// ─── Sync subcommands ───────────────────────────────────────────────────

#[derive(Parser)]
struct SyncArgs {
    #[command(subcommand)]
    action: Option<SyncAction>,
}

#[derive(Subcommand)]
enum SyncAction {
    /// Push local data to server (migrate)
    Push,
}

// ─── Error helper ───────────────────────────────────────────────────────

fn run_or_exit<F: FnOnce() -> std::result::Result<(), Box<dyn std::error::Error>>>(f: F) {
    if let Err(e) = f() {
        eprintln!("Error: {}", e);
        process::exit(1);
    }
}

// ─── Main ───────────────────────────────────────────────────────────────

fn main() {
    let cli = Cli::parse();

    update_check::check_for_updates();

    let taskbook_dir = cli.taskbook_dir;

    match cli.command {
        // No command → launch TUI
        None => {
            if let Err(e) = tui::run(taskbook_dir.as_deref()) {
                eprintln!("TUI error: {}", e);
                process::exit(1);
            }
        }

        Some(Commands::Task(args)) => dispatch_task(args, taskbook_dir),
        Some(Commands::Note(args)) => dispatch_note(args, taskbook_dir),

        Some(Commands::Find { query }) => {
            run_or_exit(|| {
                cmd_run(query, taskbook_dir, |f| f.find = true);
                Ok(())
            });
        }

        Some(Commands::List { filter }) => {
            run_or_exit(|| {
                cmd_run(filter, taskbook_dir, |f| f.list = true);
                Ok(())
            });
        }

        Some(Commands::Timeline) => {
            run_or_exit(|| {
                cmd_run(vec![], taskbook_dir, |f| f.timeline = true);
                Ok(())
            });
        }

        Some(Commands::Archive(args)) => dispatch_archive(args, taskbook_dir),
        Some(Commands::Auth(args)) => dispatch_auth(args),
        Some(Commands::Token(args)) => dispatch_token(args),

        Some(Commands::Sync(args)) => match args.action {
            Some(SyncAction::Push) | None => {
                run_or_exit(|| commands::migrate(taskbook_dir).map_err(|e| e.into()));
            }
        },

        Some(Commands::Completions { shell }) => {
            generate(shell, &mut Cli::command(), "tb", &mut io::stdout());
        }
    }
}

// ─── Dispatch helpers ───────────────────────────────────────────────────

/// Flags struct to bridge subcommands to the existing commands::run() interface
#[derive(Default)]
struct CmdFlags {
    archive: bool,
    task: bool,
    restore: bool,
    note: bool,
    delete: bool,
    check: bool,
    begin: bool,
    star: bool,
    priority: bool,
    copy: bool,
    timeline: bool,
    find: bool,
    list: bool,
    edit: bool,
    edit_note: bool,
    r#move: bool,
    clear: bool,
    tag: bool,
}

fn cmd_run(
    input: Vec<String>,
    taskbook_dir: Option<PathBuf>,
    set_flags: impl FnOnce(&mut CmdFlags),
) {
    let mut flags = CmdFlags::default();
    set_flags(&mut flags);

    let result = commands::run(
        input,
        flags.archive,
        flags.task,
        flags.restore,
        flags.note,
        flags.delete,
        flags.check,
        flags.begin,
        flags.star,
        flags.priority,
        flags.copy,
        flags.timeline,
        flags.find,
        flags.list,
        flags.edit,
        flags.edit_note,
        flags.r#move,
        flags.clear,
        flags.tag,
        taskbook_dir,
    );

    if let Err(e) = result {
        eprintln!("{}", e);
        process::exit(1);
    }
}

fn dispatch_task(args: TaskArgs, taskbook_dir: Option<PathBuf>) {
    match args.action {
        // Explicit subcommands
        Some(TaskAction::Create { description }) => {
            cmd_run(description, taskbook_dir, |f| f.task = true);
        }
        Some(TaskAction::Check { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.check = true);
        }
        Some(TaskAction::Begin { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.begin = true);
        }
        Some(TaskAction::Delete { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.delete = true);
        }
        Some(TaskAction::Edit { input }) => {
            cmd_run(input, taskbook_dir, |f| f.edit = true);
        }
        Some(TaskAction::EditNote { input }) => {
            cmd_run(input, taskbook_dir, |f| f.edit_note = true);
        }
        Some(TaskAction::Move { input }) => {
            cmd_run(input, taskbook_dir, |f| f.r#move = true);
        }
        Some(TaskAction::Priority { input }) => {
            cmd_run(input, taskbook_dir, |f| f.priority = true);
        }
        Some(TaskAction::Star { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.star = true);
        }
        Some(TaskAction::Tag { input }) => {
            cmd_run(input, taskbook_dir, |f| f.tag = true);
        }
        Some(TaskAction::Copy { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.copy = true);
        }
        Some(TaskAction::Clear) => {
            cmd_run(vec![], taskbook_dir, |f| f.clear = true);
        }
        // Shorthand: `tb task Buy groceries` → create task
        None => {
            if args.input.is_empty() {
                // No input → show task help
                let _ = TaskArgs::command().print_help();
                println!();
            } else {
                cmd_run(args.input, taskbook_dir, |f| f.task = true);
            }
        }
    }
}

fn dispatch_note(args: NoteArgs, taskbook_dir: Option<PathBuf>) {
    match args.action {
        Some(NoteAction::Create { description }) => {
            cmd_run(description, taskbook_dir, |f| f.note = true);
        }
        // Shorthand: `tb note Remember this` → create note
        None => {
            // Empty input opens editor (existing behavior)
            cmd_run(args.input, taskbook_dir, |f| f.note = true);
        }
    }
}

fn dispatch_archive(args: ArchiveArgs, taskbook_dir: Option<PathBuf>) {
    match args.action {
        Some(ArchiveAction::Show) | None => {
            cmd_run(vec![], taskbook_dir, |f| f.archive = true);
        }
        Some(ArchiveAction::Restore { ids }) => {
            cmd_run(ids, taskbook_dir, |f| f.restore = true);
        }
        Some(ArchiveAction::Clear) => {
            cmd_run(vec![], taskbook_dir, |f| f.clear = true);
        }
    }
}

fn dispatch_auth(args: AuthArgs) {
    run_or_exit(|| {
        match args.action {
            AuthAction::Register {
                server,
                username,
                email,
                password,
            } => {
                auth::register(
                    server.as_deref(),
                    username.as_deref(),
                    email.as_deref(),
                    password.as_deref(),
                )?;
            }
            AuthAction::Login {
                server,
                username,
                password,
                key,
                token,
            } => {
                auth::login(
                    server.as_deref(),
                    username.as_deref(),
                    password.as_deref(),
                    key.as_deref(),
                    token.as_deref(),
                )?;
            }
            AuthAction::LoginSso { server, key } => {
                auth::login_sso(server.as_deref(), key.as_deref())?;
            }
            AuthAction::LoginSsoManual { server, key } => {
                auth::login_sso_manual(server.as_deref(), key.as_deref())?;
            }
            AuthAction::SetToken { server, token, key } => {
                auth::set_token(server.as_deref(), token.as_deref(), key.as_deref())?;
            }
            AuthAction::Logout => {
                auth::logout()?;
            }
            AuthAction::Status => {
                auth::status()?;
            }
            AuthAction::ResetKey => {
                auth::reset_encryption_key()?;
            }
        }
        Ok(())
    });
}

fn dispatch_token(args: TokenArgs) {
    run_or_exit(|| {
        match args.action {
            TokenAction::List => {
                auth::list_tokens()?;
            }
            TokenAction::Create { name } => {
                auth::create_token(&name)?;
            }
            TokenAction::Revoke { name_or_id } => {
                auth::revoke_token(&name_or_id)?;
            }
        }
        Ok(())
    });
}
