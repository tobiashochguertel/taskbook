use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::{HeaderMap, Uri};
use chrono::Utc;
use uuid::Uuid;

use crate::error::ServerError;
use crate::pat;
use crate::router::AppState;

/// Extracted from the Authorization header after middleware validation.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ServerError;

    fn from_request_parts<'a, 'b, 'c>(
        parts: &'a mut Parts,
        state: &'b AppState,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self, Self::Rejection>> + Send + 'c>,
    >
    where
        'a: 'c,
        'b: 'c,
        Self: 'c,
    {
        Box::pin(async move {
            let token = extract_bearer_token(&parts.headers)
                .or_else(|| extract_query_token(&parts.uri))
                .ok_or(ServerError::Unauthorized)?;

            if pat::is_pat(&token) {
                // PAT: look up by SHA-256 hash
                let token_hash = pat::hash_token(&token);
                let now = Utc::now();
                let row = sqlx::query_as::<_, (Uuid, Uuid)>(
                    "SELECT id, user_id FROM personal_access_tokens \
                     WHERE token_hash = $1 AND (expires_at IS NULL OR expires_at > $2)",
                )
                .bind(&token_hash)
                .bind(now)
                .fetch_optional(&state.pool)
                .await
                .map_err(ServerError::Database)?
                .ok_or(ServerError::Unauthorized)?;

                let pat_id = row.0;
                let user_id = row.1;

                // Fire-and-forget: update last_used_at
                let pool = state.pool.clone();
                tokio::spawn(async move {
                    let _ = sqlx::query(
                        "UPDATE personal_access_tokens SET last_used_at = $1 WHERE id = $2",
                    )
                    .bind(Utc::now())
                    .bind(pat_id)
                    .execute(&pool)
                    .await;
                });

                Ok(AuthUser { user_id })
            } else {
                // Session token: existing behaviour
                let session = sqlx::query_as::<_, (Uuid,)>(
                    "SELECT user_id FROM sessions WHERE token = $1 AND expires_at > $2",
                )
                .bind(&token)
                .bind(Utc::now())
                .fetch_optional(&state.pool)
                .await
                .map_err(ServerError::Database)?
                .ok_or(ServerError::Unauthorized)?;

                Ok(AuthUser { user_id: session.0 })
            }
        })
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value.strip_prefix("Bearer ").map(|token| token.to_string())
}

/// Fallback: extract token from `?token=...` query parameter (used by EventSource/SSE).
fn extract_query_token(uri: &Uri) -> Option<String> {
    uri.query().and_then(|q| {
        q.split('&')
            .find_map(|pair| pair.strip_prefix("token="))
            .map(|t| t.to_string())
    })
}
