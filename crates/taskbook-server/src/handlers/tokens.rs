use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::constants;
use crate::error::{Result, ServerError};
use crate::middleware::AuthUser;
use crate::pat;
use crate::router::AppState;

// ── Request / Response types ────────────────────────────────────────────

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateTokenRequest {
    /// Human-readable name (unique per user, 1-128 chars).
    pub name: String,
    /// Optional expiry in days. `null` = never expires.
    pub expires_in_days: Option<i64>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct CreateTokenResponse {
    pub id: Uuid,
    pub name: String,
    /// The raw token — shown **once**, never retrievable again.
    pub token: String,
    pub token_prefix: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct TokenInfo {
    pub id: Uuid,
    pub name: String,
    pub token_prefix: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct TokenListResponse {
    pub tokens: Vec<TokenInfo>,
}

// ── Handlers ────────────────────────────────────────────────────────────

/// Create a new Personal Access Token.
#[utoipa::path(
    post,
    path = "/api/v1/me/tokens",
    request_body = CreateTokenRequest,
    responses(
        (status = 201, description = "Token created", body = CreateTokenResponse),
        (status = 400, description = "Validation error"),
        (status = 401, description = "Authentication required"),
        (status = 409, description = "Token name already exists"),
    ),
    security(("bearer" = [])),
    tag = "tokens"
)]
#[tracing::instrument(skip(state), fields(token_name = %req.name))]
pub async fn create_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateTokenRequest>,
) -> Result<(StatusCode, Json<CreateTokenResponse>)> {
    // Validate name
    if req.name.is_empty() || req.name.len() > constants::MAX_TOKEN_NAME_LEN {
        return Err(ServerError::Validation(
            format!("token name must be 1-{} characters", constants::MAX_TOKEN_NAME_LEN),
        ));
    }
    if !req
        .name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == ' ' || c == '.')
    {
        return Err(ServerError::Validation(
            "token name must contain only alphanumeric characters, spaces, hyphens, underscores, or dots".into(),
        ));
    }

    if let Some(days) = req.expires_in_days {
        if !(constants::MIN_TOKEN_EXPIRY_DAYS..=constants::MAX_TOKEN_EXPIRY_DAYS).contains(&days) {
            return Err(ServerError::Validation(
                format!(
                    "expires_in_days must be between {} and {}",
                    constants::MIN_TOKEN_EXPIRY_DAYS, constants::MAX_TOKEN_EXPIRY_DAYS,
                ),
            ));
        }
    }

    let (raw_token, token_hash, token_prefix) = pat::generate_pat();

    let expires_at = req.expires_in_days.map(|d| Utc::now() + Duration::days(d));

    let row = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        r#"INSERT INTO personal_access_tokens (user_id, name, token_hash, token_prefix, expires_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, created_at"#,
    )
    .bind(auth.user_id)
    .bind(&req.name)
    .bind(&token_hash)
    .bind(&token_prefix)
    .bind(expires_at)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            ServerError::Validation(format!("token name '{}' already exists", req.name))
        }
        _ => ServerError::Database(e),
    })?;

    tracing::info!(user_id = %auth.user_id, token_name = %req.name, "personal access token created");

    Ok((
        StatusCode::CREATED,
        Json(CreateTokenResponse {
            id: row.0,
            name: req.name,
            token: raw_token,
            token_prefix,
            expires_at,
            created_at: row.1,
        }),
    ))
}

/// List all Personal Access Tokens for the authenticated user.
#[utoipa::path(
    get,
    path = "/api/v1/me/tokens",
    responses(
        (status = 200, description = "Token list", body = TokenListResponse),
        (status = 401, description = "Authentication required"),
    ),
    security(("bearer" = [])),
    tag = "tokens"
)]
#[tracing::instrument(skip(state))]
pub async fn list_tokens(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<TokenListResponse>> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Option<DateTime<Utc>>,
            Option<DateTime<Utc>>,
            DateTime<Utc>,
        ),
    >(
        r#"SELECT id, name, token_prefix, expires_at, last_used_at, created_at
           FROM personal_access_tokens
           WHERE user_id = $1
           ORDER BY created_at DESC"#,
    )
    .bind(auth.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(ServerError::Database)?;

    let tokens = rows
        .into_iter()
        .map(|r| TokenInfo {
            id: r.0,
            name: r.1,
            token_prefix: r.2,
            expires_at: r.3,
            last_used_at: r.4,
            created_at: r.5,
        })
        .collect();

    Ok(Json(TokenListResponse { tokens }))
}

/// Revoke (delete) a Personal Access Token by ID.
#[utoipa::path(
    delete,
    path = "/api/v1/me/tokens/{id}",
    params(("id" = Uuid, Path, description = "Token UUID")),
    responses(
        (status = 204, description = "Token revoked"),
        (status = 401, description = "Authentication required"),
        (status = 404, description = "Token not found"),
    ),
    security(("bearer" = [])),
    tag = "tokens"
)]
#[tracing::instrument(skip(state))]
pub async fn revoke_token(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query("DELETE FROM personal_access_tokens WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.user_id)
        .execute(&state.pool)
        .await
        .map_err(ServerError::Database)?;

    if result.rows_affected() == 0 {
        return Err(ServerError::Validation("token not found".into()));
    }

    tracing::info!(user_id = %auth.user_id, token_id = %id, "personal access token revoked");

    Ok(StatusCode::NO_CONTENT)
}
