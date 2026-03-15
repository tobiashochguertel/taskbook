use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::{json, Value};

use crate::router::AppState;

pub async fn root_info() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "service": "taskbook-server",
        "oidc_login": "/auth/oidc/login",
        "api": "/api/v1/",
        "health": "/api/v1/health"
    }))
}

#[tracing::instrument(skip(state))]
pub async fn health(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "ok" }))),
        Err(e) => {
            tracing::error!(error = %e, "health check: database unavailable");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "status": "error", "message": "database unavailable" })),
            )
        }
    }
}
