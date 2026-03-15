use std::net::SocketAddr;

use axum::extract::{ConnectInfo, State};
use axum::Json;
use base64::Engine;
use chrono::{Duration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{hash_password, verify_password};
use crate::error::{Result, ServerError};
use crate::middleware::AuthUser;
use crate::router::AppState;

#[derive(Deserialize, utoipa::ToSchema)]
pub struct RegisterRequest {
    /// Username (1-64 chars, alphanumeric/underscore/dash)
    pub username: String,
    /// Email address
    pub email: String,
    /// Password (8-1024 chars)
    pub password: String,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct RegisterResponse {
    /// Session token
    pub token: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct MeResponse {
    pub username: String,
    pub email: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "Registration successful", body = RegisterResponse),
        (status = 400, description = "Validation error"),
        (status = 409, description = "User already exists"),
        (status = 429, description = "Rate limit exceeded"),
    ),
    tag = "auth"
)]
#[tracing::instrument(skip(state, req), fields(username = %req.username))]
pub async fn register(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>> {
    // Rate limit check
    if !state.auth_rate_limiter.check(addr.ip()).await {
        tracing::warn!(ip = %addr.ip(), "register rate limited");
        return Err(ServerError::RateLimited);
    }

    validate_registration(&req)?;

    let password_hash = hash_password(&req.password)
        .map_err(|e| ServerError::Internal(format!("password hashing failed: {e}")))?;

    let user_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(&req.username)
    .bind(&req.email)
    .bind(&password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            ServerError::UserAlreadyExists
        }
        _ => ServerError::Database(e),
    })?;

    let token = create_session(&state.pool, user_id, state.session_expiry_days).await?;

    tracing::info!(username = %req.username, "user registered");

    Ok(Json(RegisterResponse { token }))
}

#[utoipa::path(
    post,
    path = "/api/v1/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = LoginResponse),
        (status = 401, description = "Invalid credentials"),
        (status = 429, description = "Rate limit exceeded"),
    ),
    tag = "auth"
)]
#[tracing::instrument(skip(state, req), fields(username = %req.username))]
pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    // Rate limit check
    if !state.auth_rate_limiter.check(addr.ip()).await {
        tracing::warn!(ip = %addr.ip(), "login rate limited");
        return Err(ServerError::RateLimited);
    }

    let user = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT id, password FROM users WHERE username = $1",
    )
    .bind(&req.username)
    .fetch_optional(&state.pool)
    .await
    .map_err(ServerError::Database)?
    .ok_or(ServerError::InvalidCredentials)?;

    let (user_id, password_hash) = user;
    let password_hash = password_hash.ok_or(ServerError::InvalidCredentials)?;

    let valid = verify_password(&req.password, &password_hash)
        .map_err(|e| ServerError::Internal(format!("password verification failed: {e}")))?;

    if !valid {
        tracing::warn!(username = %req.username, "failed login attempt");
        return Err(ServerError::InvalidCredentials);
    }

    let token = create_session(&state.pool, user_id, state.session_expiry_days).await?;

    tracing::info!(username = %req.username, "user logged in");

    Ok(Json(LoginResponse { token }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/logout",
    responses(
        (status = 200, description = "Logged out successfully"),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "auth"
)]
#[tracing::instrument(skip(state))]
pub async fn logout(State(state): State<AppState>, auth: AuthUser) -> Result<()> {
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(auth.user_id)
        .execute(&state.pool)
        .await
        .map_err(ServerError::Database)?;

    tracing::info!(user_id = %auth.user_id, "user logged out");

    Ok(())
}

#[utoipa::path(
    get,
    path = "/api/v1/me",
    responses(
        (status = 200, description = "Current user info", body = MeResponse),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "auth"
)]
#[tracing::instrument(skip(state))]
pub async fn me(State(state): State<AppState>, auth: AuthUser) -> Result<Json<MeResponse>> {
    let user =
        sqlx::query_as::<_, (String, String)>("SELECT username, email FROM users WHERE id = $1")
            .bind(auth.user_id)
            .fetch_one(&state.pool)
            .await
            .map_err(ServerError::Database)?;

    Ok(Json(MeResponse {
        username: user.0,
        email: user.1,
    }))
}

/// Generate a cryptographically random 256-bit session token.
pub(crate) async fn create_session(
    pool: &PgPool,
    user_id: Uuid,
    expiry_days: i64,
) -> Result<String> {
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill(&mut token_bytes);
    let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(token_bytes);
    let expires_at = Utc::now() + Duration::days(expiry_days);

    sqlx::query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(&token)
        .bind(expires_at)
        .execute(pool)
        .await
        .map_err(ServerError::Database)?;

    Ok(token)
}

/// Validate registration input fields.
fn validate_registration(req: &RegisterRequest) -> Result<()> {
    if req.username.is_empty() || req.password.is_empty() || req.email.is_empty() {
        return Err(ServerError::Validation(
            "username, email, and password are required".to_string(),
        ));
    }

    if req.username.len() > 64 {
        return Err(ServerError::Validation(
            "username must be at most 64 characters".to_string(),
        ));
    }

    if !req
        .username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(ServerError::Validation(
            "username must contain only alphanumeric characters, hyphens, underscores, or dots"
                .to_string(),
        ));
    }

    if req.email.len() > 255 {
        return Err(ServerError::Validation(
            "email must be at most 255 characters".to_string(),
        ));
    }

    if !req.email.contains('@') || !req.email.contains('.') {
        return Err(ServerError::Validation(
            "email must be a valid email address".to_string(),
        ));
    }

    if req.password.len() < 8 {
        return Err(ServerError::Validation(
            "password must be at least 8 characters".to_string(),
        ));
    }

    if req.password.len() > 1024 {
        return Err(ServerError::Validation(
            "password must be at most 1024 characters".to_string(),
        ));
    }

    // Allow all printable Unicode characters (letters, digits, punctuation, symbols,
    // spaces). Reject control characters (null bytes, newlines, tabs, etc.) which are
    // not meaningful in passwords and can cause hashing or transport issues.
    if req.password.chars().any(|c| c.is_control()) {
        return Err(ServerError::Validation(
            "password must contain only printable characters".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_req(username: &str, email: &str, password: &str) -> RegisterRequest {
        RegisterRequest {
            username: username.to_string(),
            email: email.to_string(),
            password: password.to_string(),
        }
    }

    #[test]
    fn password_with_special_chars_is_accepted() {
        let passwords = [
            "6S1%4Y#VB@LKKf3kanx%04J1",
            "P@$$w0rd!",
            "correcthorsebatterystaple",
            "abc!@#$%^&*()_+-=[]{}|;':\",./<>?`~",
            "密码abc123!@#",
        ];
        for pw in &passwords {
            let req = make_req("user", "user@example.com", pw);
            assert!(
                validate_registration(&req).is_ok(),
                "expected password to be accepted: {pw}"
            );
        }
    }

    #[test]
    fn password_with_control_chars_is_rejected() {
        let bad_passwords = [
            "password\x00null",
            "pass\nword",
            "pass\tword",
            "pass\x01soh",
        ];
        for pw in &bad_passwords {
            let req = make_req("user", "user@example.com", pw);
            assert!(
                validate_registration(&req).is_err(),
                "expected password with control char to be rejected"
            );
        }
    }

    #[test]
    fn password_too_short_is_rejected() {
        let req = make_req("user", "user@example.com", "short");
        assert!(validate_registration(&req).is_err());
    }

    #[test]
    fn valid_registration_passes() {
        let req = make_req("valid_user", "user@example.com", "ValidPass1!");
        assert!(validate_registration(&req).is_ok());
    }

    #[test]
    fn username_with_dot_is_accepted() {
        let usernames = [
            "tobias.hochguertel",
            "first.last",
            "user.name_123",
            "a.b.c",
        ];
        for u in &usernames {
            let req = make_req(u, "user@example.com", "ValidPass1!");
            assert!(
                validate_registration(&req).is_ok(),
                "expected username with dot to be accepted: {u}"
            );
        }
    }

    #[test]
    fn username_with_at_sign_is_rejected() {
        let req = make_req("user@example.com", "user@example.com", "ValidPass1!");
        assert!(
            validate_registration(&req).is_err(),
            "@ in username should be rejected — use the email field for email addresses"
        );
    }
}
