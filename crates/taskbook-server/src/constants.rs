// Centralized constants for the taskbook server.
// Keeps magic numbers in one place for easy tuning and documentation.

// ── Database Pool ───────────────────────────────────────────────────
pub const DB_SLOW_STATEMENT_THRESHOLD_SECS: u64 = 5;
pub const DB_MAX_CONNECTIONS: u32 = 10;
pub const DB_ACQUIRE_TIMEOUT_SECS: u64 = 5;
pub const DB_IDLE_TIMEOUT_SECS: u64 = 300;
pub const DB_MAX_LIFETIME_SECS: u64 = 1800;

// ── Server Defaults ─────────────────────────────────────────────────
pub const DEFAULT_DB_PORT: &str = "5432";
pub const DEFAULT_HOST: &str = "0.0.0.0";
pub const DEFAULT_PORT: &str = "8080";
pub const DEFAULT_SESSION_EXPIRY_DAYS: &str = "30";

// ── Rate Limiting ───────────────────────────────────────────────────
pub const AUTH_RATE_LIMIT_REQUESTS: usize = 10;
pub const AUTH_RATE_LIMIT_WINDOW_SECS: u64 = 60;

// ── Request Limits ──────────────────────────────────────────────────
pub const MAX_REQUEST_BODY_BYTES: usize = 10 * 1024 * 1024; // 10 MB

// ── Validation: User ────────────────────────────────────────────────
pub const MAX_USERNAME_LEN: usize = 64;
pub const MAX_EMAIL_LEN: usize = 255;
pub const MIN_PASSWORD_LEN: usize = 8;
pub const MAX_PASSWORD_LEN: usize = 1024;

// ── Validation: Tokens ──────────────────────────────────────────────
pub const MAX_TOKEN_NAME_LEN: usize = 128;
pub const MIN_TOKEN_EXPIRY_DAYS: i64 = 1;
pub const MAX_TOKEN_EXPIRY_DAYS: i64 = 3650;
