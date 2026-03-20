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
use crate::constants;
use crate::db::dal;
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

#[derive(Deserialize, utoipa::ToSchema)]
pub struct UpdateMeRequest {
    pub username: Option<String>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct UpdateMeResponse {
    pub username: String,
    pub email: String,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct EncryptionKeyStatus {
    pub has_key: bool,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct StoreKeyRequest {
    pub encryption_key: String,
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

    let user_id = dal::insert_user(&state.pool, &req.username, &req.email, Some(&password_hash))
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

    let user = dal::find_user_credentials(&state.pool, &req.username)
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
    dal::delete_user_sessions(&state.pool, auth.user_id)
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
    let user = dal::get_user_profile(&state.pool, auth.user_id)
        .await
        .map_err(ServerError::Database)?;

    Ok(Json(MeResponse {
        username: user.0,
        email: user.1,
    }))
}

#[utoipa::path(
    patch,
    path = "/api/v1/me",
    request_body = UpdateMeRequest,
    responses(
        (status = 200, description = "Profile updated", body = UpdateMeResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Authentication required"),
        (status = 409, description = "Username taken"),
    ),
    security(("bearer" = [])),
    tag = "auth"
)]
pub async fn update_me(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<UpdateMeRequest>,
) -> Result<Json<UpdateMeResponse>> {
    if let Some(ref username) = req.username {
        validate_username(username)?;

        dal::update_username(&state.pool, auth.user_id, username)
            .await
            .map_err(|e| match e {
                sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
                    ServerError::UserAlreadyExists
                }
                _ => ServerError::Database(e),
            })?;
    }

    let user = dal::get_user_profile(&state.pool, auth.user_id)
        .await
        .map_err(ServerError::Database)?;

    Ok(Json(UpdateMeResponse {
        username: user.0,
        email: user.1,
    }))
}

/// Check if user has an encryption key stored.
#[utoipa::path(
    get,
    path = "/api/v1/me/encryption-key",
    responses(
        (status = 200, description = "Key status", body = EncryptionKeyStatus),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "encryption"
)]
pub async fn get_encryption_key_status(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<EncryptionKeyStatus>> {
    let has_key = dal::get_encryption_key_hash(&state.pool, auth.user_id)
        .await
        .map_err(ServerError::Database)?
        .is_some();

    Ok(Json(EncryptionKeyStatus { has_key }))
}

/// Store encryption key (hashed, for cross-device sync indication).
#[utoipa::path(
    post,
    path = "/api/v1/me/encryption-key",
    request_body = StoreKeyRequest,
    responses(
        (status = 200, description = "Key stored", body = EncryptionKeyStatus),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "encryption"
)]
pub async fn store_encryption_key(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<StoreKeyRequest>,
) -> Result<Json<EncryptionKeyStatus>> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(req.encryption_key.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    dal::set_encryption_key_hash(&state.pool, auth.user_id, &hash)
        .await
        .map_err(ServerError::Database)?;

    Ok(Json(EncryptionKeyStatus { has_key: true }))
}

/// Reset encryption key — clears key hash AND all user data.
#[utoipa::path(
    delete,
    path = "/api/v1/me/encryption-key",
    responses(
        (status = 200, description = "Key reset, data cleared", body = EncryptionKeyStatus),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "encryption"
)]
pub async fn reset_encryption_key(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<EncryptionKeyStatus>> {
    dal::clear_encryption_key_hash(&state.pool, auth.user_id)
        .await
        .map_err(ServerError::Database)?;

    dal::delete_all_user_items(&state.pool, auth.user_id)
        .await
        .map_err(ServerError::Database)?;

    Ok(Json(EncryptionKeyStatus { has_key: false }))
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

    dal::insert_session(pool, user_id, &token, expires_at)
        .await
        .map_err(ServerError::Database)?;

    Ok(token)
}

/// Validate registration input fields.
/// Shared username validation: 1-64 chars, alphanumeric/underscore/dash/dot
fn validate_username(username: &str) -> Result<()> {
    if username.is_empty() || username.len() > constants::MAX_USERNAME_LEN {
        return Err(ServerError::Validation(format!(
            "username must be 1-{} characters",
            constants::MAX_USERNAME_LEN
        )));
    }
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(ServerError::Validation(
            "username must contain only alphanumeric characters, hyphens, underscores, or dots"
                .into(),
        ));
    }
    Ok(())
}

fn validate_registration(req: &RegisterRequest) -> Result<()> {
    if req.username.is_empty() || req.password.is_empty() || req.email.is_empty() {
        return Err(ServerError::Validation(
            "username, email, and password are required".to_string(),
        ));
    }

    validate_username(&req.username)?;

    if req.email.len() > constants::MAX_EMAIL_LEN {
        return Err(ServerError::Validation(format!(
            "email must be at most {} characters",
            constants::MAX_EMAIL_LEN
        )));
    }

    if !req.email.contains('@') || !req.email.contains('.') {
        return Err(ServerError::Validation(
            "email must be a valid email address".to_string(),
        ));
    }

    if req.password.len() < constants::MIN_PASSWORD_LEN {
        return Err(ServerError::Validation(format!(
            "password must be at least {} characters",
            constants::MIN_PASSWORD_LEN
        )));
    }

    if req.password.len() > constants::MAX_PASSWORD_LEN {
        return Err(ServerError::Validation(format!(
            "password must be at most {} characters",
            constants::MAX_PASSWORD_LEN
        )));
    }

    Ok(())
}
