use std::net::IpAddr;

use crate::constants;

/// OIDC provider configuration for SSO login.
/// Enabled only when all three required env vars are present.
#[derive(Clone, Debug)]
pub struct OidcConfig {
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
    /// Public base URL of this server, used to construct the redirect_uri.
    /// Defaults to `http://{host}:{port}` if not set.
    pub base_url: String,
    /// Allowed post-login redirect URIs for SPA clients.
    /// Set via `TB_OIDC_ALLOWED_REDIRECTS` (comma-separated).
    pub allowed_redirects: Vec<String>,
}

/// Server configuration, loaded from environment variables.
///
/// Database connection is built from individual variables:
/// - `TB_DB_HOST` (required) - Database hostname
/// - `TB_DB_PORT` (optional, default: 5432) - Database port
/// - `TB_DB_NAME` (required) - Database name
/// - `TB_DB_USER` (required) - Database username
/// - `TB_DB_PASSWORD` (required) - Database password
pub struct ServerConfig {
    pub host: IpAddr,
    pub port: u16,
    pub database_url: String,
    pub session_expiry_days: i64,
    /// Allowed CORS origins (comma-separated). If empty, defaults to restrictive.
    pub cors_origins: Vec<String>,
    /// Optional OIDC SSO configuration. None = OIDC disabled.
    pub oidc: Option<OidcConfig>,
}

impl ServerConfig {
    pub fn load() -> Result<Self, String> {
        let db_host = require_env("TB_DB_HOST")?;
        let db_port = std::env::var("TB_DB_PORT").unwrap_or_else(|_| constants::DEFAULT_DB_PORT.to_string());
        let db_name = require_env("TB_DB_NAME")?;
        let db_user = require_env("TB_DB_USER")?;
        let db_password = require_env("TB_DB_PASSWORD")?;

        let database_url = format!(
            "postgres://{}:{}@{}:{}/{}",
            db_user, db_password, db_host, db_port, db_name
        );

        let host: IpAddr = std::env::var("TB_HOST")
            .unwrap_or_else(|_| constants::DEFAULT_HOST.to_string())
            .parse()
            .map_err(|_| "TB_HOST must be a valid IP address".to_string())?;

        let port: u16 = std::env::var("TB_PORT")
            .unwrap_or_else(|_| constants::DEFAULT_PORT.to_string())
            .parse()
            .map_err(|_| "TB_PORT must be a valid port number".to_string())?;

        let session_expiry_days: i64 = std::env::var("TB_SESSION_EXPIRY_DAYS")
            .unwrap_or_else(|_| constants::DEFAULT_SESSION_EXPIRY_DAYS.to_string())
            .parse()
            .map_err(|_| "TB_SESSION_EXPIRY_DAYS must be a number".to_string())?;

        let cors_origins: Vec<String> = std::env::var("TB_CORS_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let oidc = match (
            std::env::var("TB_OIDC_ISSUER").ok(),
            std::env::var("TB_OIDC_CLIENT_ID").ok(),
            std::env::var("TB_OIDC_CLIENT_SECRET").ok(),
        ) {
            (Some(issuer), Some(client_id), Some(client_secret)) => {
                let base_url = std::env::var("TB_OIDC_BASE_URL")
                    .unwrap_or_else(|_| format!("http://{}:{}", host, port));
                let allowed_redirects: Vec<String> = std::env::var("TB_OIDC_ALLOWED_REDIRECTS")
                    .unwrap_or_default()
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                Some(OidcConfig {
                    issuer,
                    client_id,
                    client_secret,
                    base_url,
                    allowed_redirects,
                })
            }
            _ => None,
        };

        Ok(Self {
            host,
            port,
            database_url,
            session_expiry_days,
            cors_origins,
            oidc,
        })
    }
}

fn require_env(key: &str) -> Result<String, String> {
    std::env::var(key).map_err(|_| format!("{key} environment variable is required"))
}
