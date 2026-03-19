use std::io::{self, Write};

use base64::Engine;
use colored::Colorize;

use crate::api_client::{ApiClient, LoginRequest, RegisterRequest};
use crate::config::Config;
use crate::credentials::Credentials;
use crate::error::{Result, TaskbookError};
use crate::sso;

// ---------------------------------------------------------------------------
// Shared helpers (DRY extraction)
// ---------------------------------------------------------------------------

/// Resolve the server URL from an explicit argument, config, or interactive prompt.
fn resolve_server_url(server_url: Option<&str>) -> Result<String> {
    match server_url {
        Some(s) => Ok(s.to_string()),
        None => {
            let config = Config::load_or_default();
            if config.sync.enabled {
                println!("Using server: {}", config.sync.server_url);
                Ok(config.sync.server_url)
            } else {
                prompt("Server URL: ")
            }
        }
    }
}

/// Resolve the encryption key: explicit > existing credentials > prompt/generate.
fn resolve_encryption_key(explicit: Option<&str>, server: &str) -> Result<String> {
    if let Some(k) = explicit {
        return Ok(k.to_string());
    }
    if let Some(existing) = Credentials::for_server(server)? {
        println!(
            "{}",
            "Reusing existing encryption key from previous login.".dimmed()
        );
        return Ok(existing.encryption_key);
    }
    prompt_or_generate_key()
}

/// Prompt for an encryption key or generate a new one if left blank.
fn prompt_or_generate_key() -> Result<String> {
    let input = prompt("Encryption key (leave blank to generate new): ")?;
    if input.is_empty() {
        Ok(generate_and_print_key())
    } else {
        Ok(input)
    }
}

/// Generate a new encryption key, print it, and return the base64 string.
fn generate_and_print_key() -> String {
    let raw_key = taskbook_common::encryption::generate_key();
    let key_b64 = base64::engine::general_purpose::STANDARD.encode(raw_key);
    println!(
        "{}",
        "Generated new encryption key (save this — it cannot be recovered):".yellow()
    );
    println!("  {}", key_b64.bright_white().bold());
    println!();
    key_b64
}

/// Common post-login steps: store encryption key on server, enable sync, verify token.
fn finalize_login(creds: &Credentials) -> Result<()> {
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));

    // Best-effort: store key hash on server for cross-device sync indication
    if let Err(e) = client.post_json(
        "/api/v1/me/encryption-key",
        &serde_json::json!({"encryption_key": &creds.encryption_key}),
    ) {
        eprintln!("Warning: failed to store encryption key on server: {e}");
    }

    // Enable sync
    let mut sync_cfg = Config::load_or_default();
    sync_cfg.enable_sync(&creds.server_url)?;

    // Verify the token works and print result
    match client.get_me() {
        Ok(me) => {
            println!(
                "{}",
                format!("✅ Logged in as {} ({})", me.username, me.email)
                    .green()
                    .bold()
            );
        }
        Err(_) => {
            println!("{}", "✅ Token saved.".green().bold());
            println!(
                "{}",
                "Warning: could not verify token — it may be expired.".yellow()
            );
        }
    }
    println!("{}", "Sync is now enabled.".green());

    Ok(())
}

fn prompt(message: &str) -> Result<String> {
    print!("{}", message);
    io::stdout()
        .flush()
        .map_err(|e| TaskbookError::General(format!("failed to flush stdout: {e}")))?;
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .map_err(|e| TaskbookError::General(format!("failed to read input: {e}")))?;
    Ok(input.trim().to_string())
}

fn prompt_password(message: &str) -> Result<String> {
    rpassword::prompt_password(message)
        .map_err(|e| TaskbookError::General(format!("failed to read password: {e}")))
}

/// Register a new account on the server (interactive).
pub fn register(
    server_url: Option<&str>,
    username: Option<&str>,
    email: Option<&str>,
    password: Option<&str>,
) -> Result<()> {
    println!("{}", "Register new account".bold());
    println!();

    let server = resolve_server_url(server_url)?;

    let user = match username {
        Some(u) => u.to_string(),
        None => prompt("Username: ")?,
    };

    let mail = match email {
        Some(e) => e.to_string(),
        None => prompt("Email: ")?,
    };

    let pass = match password {
        Some(p) => p.to_string(),
        None => {
            let p1 = prompt_password("Password: ")?;
            let p2 = prompt_password("Confirm password: ")?;
            if p1 != p2 {
                return Err(TaskbookError::Auth("passwords do not match".to_string()));
            }
            p1
        }
    };

    let client = ApiClient::new(&server, None);

    let resp = client.register(&RegisterRequest {
        username: user,
        email: mail,
        password: pass,
    })?;

    let key_b64 = generate_and_print_key();

    let creds = Credentials {
        server_url: server,
        token: resp.token,
        encryption_key: key_b64,
    };
    creds.save()?;

    finalize_login(&creds)?;

    println!();
    println!("{}", "Registration successful!".green().bold());

    Ok(())
}

/// Log in to an existing account (interactive or token-based).
///
/// When `token` is provided, skips username/password prompting and saves the
/// token directly (useful for OIDC-obtained tokens).
pub fn login(
    server_url: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    encryption_key: Option<&str>,
    token: Option<&str>,
) -> Result<()> {
    println!("{}", "Login".bold());
    println!();

    let server = resolve_server_url(server_url)?;
    let key = resolve_encryption_key(encryption_key, &server)?;

    let final_token = if let Some(t) = token {
        t.to_string()
    } else {
        let user = match username {
            Some(u) => u.to_string(),
            None => prompt("Username: ")?,
        };

        let pass = match password {
            Some(p) => p.to_string(),
            None => prompt_password("Password: ")?,
        };

        let client = ApiClient::new(&server, None);
        let resp = client.login(&LoginRequest {
            username: user,
            password: pass,
        })?;
        resp.token
    };

    let creds = Credentials {
        server_url: server,
        token: final_token,
        encryption_key: key,
    };
    creds.save()?;

    finalize_login(&creds)?;

    Ok(())
}

/// Log in via browser-based OIDC/SSO.
///
/// Opens the user's browser for authentication. Falls back to printing
/// a URL for headless/SSH environments.
pub fn login_sso(server_url: Option<&str>, encryption_key: Option<&str>) -> Result<()> {
    println!("{}", "SSO Login".bold());
    println!();

    let server = resolve_server_url(server_url)?;
    let result = sso::run_sso_flow(&server)?;

    // Determine encryption key:
    // 1. Provided in callback (new OIDC user) — use it
    // 2. Provided via --key flag — use it
    // 3. Existing credentials have one — reuse it
    // 4. Otherwise — generate a new one
    let key = if let Some(key) = result.encryption_key {
        if result.is_new_user {
            println!();
            println!(
                "{}",
                "⚠️  Save your encryption key — it will NOT be shown again:".yellow()
            );
            println!("  {}", key.bright_white().bold());
            println!();
        }
        key
    } else if let Some(k) = encryption_key {
        k.to_string()
    } else if let Some(existing) = Credentials::for_server(&server)? {
        existing.encryption_key
    } else {
        generate_and_print_key()
    };

    let creds = Credentials {
        server_url: server,
        token: result.token,
        encryption_key: key,
    };
    creds.save()?;

    finalize_login(&creds)?;

    Ok(())
}

/// Log in via SSO for headless/remote hosts (no browser or localhost needed).
///
/// Instead of starting a local callback server, this flow directs the user to
/// open the OIDC login URL on any device. The server will show a token page
/// where the user copies the token and encryption key, then pastes them back
/// into the CLI prompts.
pub fn login_sso_manual(server_url: Option<&str>, encryption_key: Option<&str>) -> Result<()> {
    println!("{}", "SSO Login (Manual / Headless)".bold());
    println!();

    let server = resolve_server_url(server_url)?;

    let login_url = format!("{}/auth/oidc/login", server.trim_end_matches('/'));

    println!("Open this URL in any browser (on any device):");
    println!();
    println!("  {}", login_url.bright_cyan().underline());
    println!();
    println!(
        "{}",
        "After authenticating, the server will show your session token.".dimmed()
    );
    println!("{}", "Copy the values shown and paste them below.".dimmed());
    println!();

    let token = prompt("Session token: ")?;
    if token.is_empty() {
        return Err(TaskbookError::Auth("no token provided".to_string()));
    }

    let key = resolve_encryption_key(encryption_key, &server)?;

    let creds = Credentials {
        server_url: server,
        token,
        encryption_key: key,
    };
    creds.save()?;

    finalize_login(&creds)?;

    Ok(())
}

/// Save a session token directly (non-interactive).
///
/// Designed for OIDC login workflows where the user obtains a token from the
/// browser and needs to store it in the CLI without username/password prompting.
pub fn set_token(
    server_url: Option<&str>,
    token: Option<&str>,
    encryption_key: Option<&str>,
) -> Result<()> {
    let server = resolve_server_url(server_url)?;

    let tok = match token {
        Some(t) => t.to_string(),
        None => prompt("Session token: ")?,
    };

    let key = resolve_encryption_key(encryption_key, &server)?;

    let creds = Credentials {
        server_url: server,
        token: tok,
        encryption_key: key,
    };
    creds.save()?;

    finalize_login(&creds)?;

    Ok(())
}

/// Log out and delete credentials.
pub fn logout() -> Result<()> {
    if let Some(creds) = Credentials::load()? {
        let client = ApiClient::new(&creds.server_url, Some(&creds.token));
        // Best-effort server logout
        let _ = client.logout();
    }

    Credentials::delete()?;

    // Disable sync in config
    let mut config = Config::load_or_default();
    config.disable_sync()?;

    println!("{}", "Logged out.".green());
    println!("{}", "Sync disabled, using local storage.".dimmed());

    Ok(())
}

/// Show current sync status.
pub fn status() -> Result<()> {
    let config = Config::load_or_default();

    if config.sync.enabled {
        println!("Mode:   {}", "remote".green().bold());
        println!("Server: {}", config.sync.server_url);
    } else {
        println!("Mode:   {}", "local".yellow().bold());
    }

    match Credentials::load()? {
        Some(creds) => {
            println!("Credentials: {}", "saved".green());

            // Warn if credentials were saved for a different server
            if creds.server_url != config.sync.server_url && config.sync.enabled {
                println!(
                    "{}",
                    format!(
                        "Warning: credentials were saved for {} (config points to {})",
                        creds.server_url, config.sync.server_url
                    )
                    .yellow()
                );
                println!(
                    "{}",
                    "Hint: run `tb --login` or `tb --set-token` to re-authenticate against the configured server."
                        .dimmed()
                );
            }

            if config.sync.enabled {
                // Use the config server URL (user's intent), not the stale credentials URL
                let effective_url = &config.sync.server_url;
                let client = ApiClient::new(effective_url, Some(&creds.token));
                match client.get_me() {
                    Ok(me) => {
                        println!("Session:     {}", "valid".green());
                        println!("Logged in as: {} ({})", me.username, me.email);
                    }
                    Err(e) => {
                        println!("Session:     {}", "invalid".red());
                        let err_msg = e.to_string();
                        // Redact potential tokens/credentials from error output
                        let sanitized = if err_msg.contains("token") || err_msg.contains("Bearer") {
                            err_msg
                                .split_whitespace()
                                .map(|w| {
                                    if w.len() > 20 && !w.starts_with("http") {
                                        "[REDACTED]"
                                    } else {
                                        w
                                    }
                                })
                                .collect::<Vec<_>>()
                                .join(" ")
                        } else {
                            err_msg
                        };
                        println!("Error:       {}", sanitized);
                        println!();
                        println!(
                            "{}",
                            "To fix: run `tb --login-sso` (browser SSO) or `tb --set-token` to re-authenticate."
                                .yellow()
                        );
                    }
                }
            }
        }
        None => {
            println!("Credentials: {}", "none".dimmed());
            if config.sync.enabled {
                println!();
                println!(
                    "{}",
                    "To authenticate: run `tb --login-sso` (browser SSO) or `tb --set-token`."
                        .yellow()
                );
            }
        }
    }

    // Show encryption key status
    if let Some(ref creds) = Credentials::for_server(&config.sync.server_url)? {
        if !creds.encryption_key.is_empty() {
            println!("Encryption:  {}", "configured".green());
        } else {
            println!("Encryption:  {}", "not set".yellow());
            println!(
                "{}",
                "Hint: encryption key is required for data sync.".dimmed()
            );
        }
    }

    Ok(())
}

/// Reset encryption key — generates a new one and clears server data.
pub fn reset_encryption_key() -> Result<()> {
    println!("{}", "Reset Encryption Key".bold());
    println!();
    println!("{}", "⚠️  WARNING: This will:".red().bold());
    println!("  • Generate a new encryption key");
    println!("  • Delete ALL your encrypted data on the server");
    println!("  • This action CANNOT be undone");
    println!();

    let confirm = prompt("Type 'RESET' to confirm: ")?;
    if confirm.trim() != "RESET" {
        println!("Cancelled.");
        return Ok(());
    }

    let mut creds = Credentials::load()?.ok_or_else(|| {
        TaskbookError::Auth("not logged in — run `tb --login-sso` first".to_string())
    })?;

    // Call server to reset
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));
    match client.delete_path("/api/v1/me/encryption-key") {
        Ok(_) => println!("{}", "Server data cleared.".green()),
        Err(e) => println!(
            "{}",
            format!("Warning: could not clear server data: {}", e).yellow()
        ),
    }

    // Generate new key
    let raw_key = taskbook_common::encryption::generate_key();
    let key_b64 = base64::engine::general_purpose::STANDARD.encode(raw_key);

    println!();
    println!(
        "{}",
        "New encryption key (save this — it cannot be recovered):".yellow()
    );
    println!("  {}", key_b64.bright_white().bold());
    println!();

    creds.encryption_key = key_b64;
    creds.save()?;

    // Store key hash on server
    match client.post_json(
        "/api/v1/me/encryption-key",
        &serde_json::json!({"encryption_key": &creds.encryption_key}),
    ) {
        Ok(_) => {}
        Err(e) => println!(
            "{}",
            format!("Warning: could not store key hash: {}", e).yellow()
        ),
    }

    println!(
        "{}",
        "✅ Encryption key reset. Your previous data is gone."
            .green()
            .bold()
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Personal Access Tokens
// ---------------------------------------------------------------------------

pub fn list_tokens() -> Result<()> {
    let creds = Credentials::load()?.ok_or_else(|| {
        TaskbookError::Auth("not logged in — run `tb --login` first".to_string())
    })?;
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));
    let resp = client.list_tokens()?;

    if resp.tokens.is_empty() {
        println!("{}", "No personal access tokens.".dimmed());
        return Ok(());
    }

    println!("{}", "Personal Access Tokens:".bold());
    println!(
        "  {:<36}  {:<24}  {:<12}  {:<20}  {:<20}",
        "ID", "Name", "Prefix", "Expires", "Last Used"
    );
    println!("  {}", "-".repeat(118));

    for t in &resp.tokens {
        let expires = t.expires_at.as_deref().unwrap_or("never");
        let last_used = t.last_used_at.as_deref().unwrap_or("never");
        println!(
            "  {:<36}  {:<24}  {:<12}  {:<20}  {:<20}",
            t.id, t.name, t.token_prefix, expires, last_used
        );
    }

    Ok(())
}

pub fn create_token(name: &str) -> Result<()> {
    let creds = Credentials::load()?.ok_or_else(|| {
        TaskbookError::Auth("not logged in — run `tb --login` first".to_string())
    })?;
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));
    let resp = client.create_token(name, None)?;

    println!("{}", "✅ Token created successfully!".green().bold());
    println!();
    println!("  Name:   {}", resp.name.bold());
    println!("  Prefix: {}", resp.token_prefix);
    println!("  Token:  {}", resp.token.yellow().bold());
    println!();
    println!(
        "{}",
        "⚠  Copy this token now — it will not be shown again!"
            .red()
            .bold()
    );

    Ok(())
}

pub fn revoke_token(name_or_id: &str) -> Result<()> {
    let creds = Credentials::load()?.ok_or_else(|| {
        TaskbookError::Auth("not logged in — run `tb --login` first".to_string())
    })?;
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));

    // If it looks like a UUID, use directly; otherwise look up by name.
    let token_id = if uuid_like(name_or_id) {
        name_or_id.to_string()
    } else {
        let list = client.list_tokens()?;
        let found = list.tokens.iter().find(|t| t.name == name_or_id);
        match found {
            Some(t) => t.id.clone(),
            None => {
                return Err(TaskbookError::Auth(format!(
                    "no token found with name '{}'",
                    name_or_id
                )));
            }
        }
    };

    client.revoke_token(&token_id)?;

    println!(
        "{}",
        format!("✅ Token '{}' revoked.", name_or_id).green().bold()
    );

    Ok(())
}

/// Quick check if a string looks like a UUID.
fn uuid_like(s: &str) -> bool {
    s.len() == 36 && s.chars().filter(|c| *c == '-').count() == 4
}
