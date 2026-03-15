use std::io::{self, Write};

use base64::Engine;
use colored::Colorize;

use crate::api_client::{ApiClient, LoginRequest, RegisterRequest};
use crate::config::Config;
use crate::credentials::Credentials;
use crate::error::{Result, TaskbookError};

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

    let server = match server_url {
        Some(s) => s.to_string(),
        None => prompt("Server URL: ")?,
    };

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

    // Generate encryption key locally
    let key = taskbook_common::encryption::generate_key();
    let key_b64 = base64::engine::general_purpose::STANDARD.encode(key);

    // Save credentials
    let creds = Credentials {
        server_url: server.clone(),
        token: resp.token,
        encryption_key: key_b64.clone(),
    };
    creds.save()?;

    // Enable sync in config
    let mut config = Config::load_or_default();
    config.enable_sync(&server)?;

    println!();
    println!("{}", "Registration successful!".green().bold());
    println!("{}", "Sync is now enabled.".green());
    println!();
    println!(
        "{}",
        "Your encryption key (save this — it cannot be recovered):".yellow()
    );
    println!();
    println!("  {}", key_b64.bright_white().bold());
    println!();

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

    let server = match server_url {
        Some(s) => s.to_string(),
        None => prompt("Server URL: ")?,
    };

    let key = match encryption_key {
        Some(k) => k.to_string(),
        None => prompt("Encryption key: ")?,
    };

    let final_token = if let Some(t) = token {
        // Token-only login (e.g. from OIDC web flow)
        t.to_string()
    } else {
        // Password-based login
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
        server_url: server.clone(),
        token: final_token,
        encryption_key: key,
    };
    creds.save()?;

    // Enable sync in config
    let mut config = Config::load_or_default();
    config.enable_sync(&server)?;

    println!();
    println!("{}", "Login successful!".green().bold());
    println!("{}", "Sync is now enabled.".green());

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
    let server = match server_url {
        Some(s) => s.to_string(),
        None => prompt("Server URL: ")?,
    };

    let tok = match token {
        Some(t) => t.to_string(),
        None => prompt("Session token: ")?,
    };

    let key = match encryption_key {
        Some(k) => k.to_string(),
        None => prompt("Encryption key: ")?,
    };

    let creds = Credentials {
        server_url: server.clone(),
        token: tok,
        encryption_key: key,
    };
    creds.save()?;

    // Enable sync in config
    let mut config = Config::load_or_default();
    config.enable_sync(&server)?;

    // Verify the token works
    let client = ApiClient::new(&creds.server_url, Some(&creds.token));
    match client.get_me() {
        Ok(me) => {
            println!(
                "{}",
                format!("Token saved — logged in as {} ({})", me.username, me.email)
                    .green()
                    .bold()
            );
        }
        Err(_) => {
            println!("{}", "Token saved.".green().bold());
            println!(
                "{}",
                "Warning: could not verify token — it may be expired.".yellow()
            );
        }
    }
    println!("{}", "Sync is now enabled.".green());

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
            println!("Server URL:  {}", creds.server_url);

            if config.sync.enabled {
                let client = ApiClient::new(&creds.server_url, Some(&creds.token));
                match client.get_me() {
                    Ok(me) => {
                        println!("Session:     {}", "valid".green());
                        println!("Logged in as: {} ({})", me.username, me.email);
                    }
                    Err(e) => {
                        println!("Session:     {}", "invalid".red());
                        println!("Error:       {}", e);
                    }
                }
            }
        }
        None => {
            println!("Credentials: {}", "none".dimmed());
        }
    }

    Ok(())
}
