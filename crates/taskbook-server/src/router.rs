use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use axum::http::HeaderValue;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{extract::State, Router};
use metrics_exporter_prometheus::PrometheusHandle;
use sqlx::PgPool;
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use uuid::Uuid;

use crate::config::OidcConfig;
use crate::handlers::{events, health, items, tokens, user};
use crate::metrics_middleware::HttpMetricsLayer;
use crate::openapi::ApiDoc;
use crate::rate_limit::RateLimiter;

/// Strip OIDC-provider-appended parameters (like `scope`) from the request URI
/// before the axum-oidc middleware sees it. axum-oidc's `strip_oidc_from_path`
/// only removes `code`, `state`, `session_state`, and `iss` — Authelia also
/// echoes back `scope`, which would otherwise end up in the redirect_uri causing
/// a mismatch between the authorization request and the token exchange.
///
/// Also strips the SPA's `redirect_uri` query param and persists it in the
/// tower-session so it survives the OIDC round-trip to the identity provider.
/// Without this, axum-oidc includes the full query string (including
/// `redirect_uri=...`) in the OIDC authorization redirect_uri sent to Authelia,
/// causing a mismatch with the pre-registered redirect_uris.
#[derive(Clone, Debug)]
pub struct SpaRedirectUri(pub String);

/// Session key for storing the SPA redirect_uri across the OIDC round-trip.
pub const SPA_REDIRECT_SESSION_KEY: &str = "spa_redirect_uri";

async fn strip_oidc_provider_params(
    mut req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let uri = req.uri().clone();
    if let Some(pq) = uri.path_and_query() {
        if let Some(q) = pq.query() {
            let mut spa_redirect: Option<String> = None;
            let new_q: String = q
                .split('&')
                .filter(|p| {
                    if p.starts_with("scope=") {
                        return false;
                    }
                    if p.starts_with("redirect_uri=") {
                        if let Some(val) = p.strip_prefix("redirect_uri=") {
                            spa_redirect =
                                Some(urlencoding::decode(val).unwrap_or_default().into_owned());
                        }
                        return false;
                    }
                    true
                })
                .collect::<Vec<_>>()
                .join("&");
            if let Some(ref redir) = spa_redirect {
                // Store in session so it survives the OIDC redirect round-trip.
                if let Some(session) = req.extensions().get::<tower_sessions::Session>() {
                    let _ = session
                        .insert(SPA_REDIRECT_SESSION_KEY, redir.clone())
                        .await;
                }
                req.extensions_mut().insert(SpaRedirectUri(redir.clone()));
            }
            if new_q.len() != q.len() {
                let new_pq_str = if new_q.is_empty() {
                    pq.path().to_string()
                } else {
                    format!("{}?{}", pq.path(), new_q)
                };
                if let Ok(new_pq) = new_pq_str.parse::<axum::http::uri::PathAndQuery>() {
                    let mut parts = uri.into_parts();
                    parts.path_and_query = Some(new_pq);
                    if let Ok(new_uri) = axum::http::Uri::from_parts(parts) {
                        *req.uri_mut() = new_uri;
                    }
                }
            }
        }
    }
    next.run(req).await
}

/// Event broadcast to connected SSE clients when data changes.
#[derive(Debug, Clone)]
pub enum SyncEvent {
    /// Items or archive were updated.
    DataChanged { archived: bool },
}

/// Per-user broadcast hub for real-time sync notifications.
#[derive(Clone, Default)]
pub struct NotificationHub {
    senders: Arc<RwLock<HashMap<Uuid, broadcast::Sender<SyncEvent>>>>,
}

impl NotificationHub {
    /// Subscribe to notifications for the given user.
    /// Creates a new broadcast channel if one doesn't exist yet.
    pub fn subscribe(&self, user_id: Uuid) -> broadcast::Receiver<SyncEvent> {
        let mut map = self.senders.write().unwrap();
        let sender = map
            .entry(user_id)
            .or_insert_with(|| broadcast::channel(64).0);
        sender.subscribe()
    }

    /// Send a notification to all connected clients for the given user.
    pub fn notify(&self, user_id: Uuid, event: SyncEvent) {
        let map = self.senders.read().unwrap();
        if let Some(sender) = map.get(&user_id) {
            let _ = sender.send(event);
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub session_expiry_days: i64,
    pub auth_rate_limiter: RateLimiter,
    pub notifications: NotificationHub,
    pub prometheus_handle: PrometheusHandle,
    /// Issuer URL stored for deriving the provider name in OIDC handler.
    pub oidc_issuer: Option<String>,
    /// Allowed post-login redirect URIs for SPA clients.
    pub allowed_redirects: Vec<String>,
}

pub async fn build(
    pool: PgPool,
    session_expiry_days: i64,
    cors_origins: &[String],
    prometheus_handle: PrometheusHandle,
    oidc_config: Option<&OidcConfig>,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    let auth_rate_limiter = RateLimiter::new(10, 60);

    let oidc_issuer = oidc_config.map(|c| c.issuer.clone());
    let allowed_redirects = oidc_config
        .map(|c| c.allowed_redirects.clone())
        .unwrap_or_default();

    let state = AppState {
        pool,
        session_expiry_days,
        auth_rate_limiter,
        notifications: NotificationHub::default(),
        prometheus_handle,
        oidc_issuer,
        allowed_redirects,
    };

    let cors = build_cors_layer(cors_origins);

    let swagger_ui = utoipa_swagger_ui::SwaggerUi::new("/api/docs").url(
        "/api/docs/openapi.json",
        <ApiDoc as utoipa::OpenApi>::openapi(),
    );

    let main_routes = Router::new()
        .route("/api/v1/info", get(health::root_info))
        .route("/api/v1/health", get(health::health))
        .route("/api/v1/register", post(user::register))
        .route("/api/v1/login", post(user::login))
        .route("/api/v1/logout", delete(user::logout))
        .route("/api/v1/me", get(user::me).patch(user::update_me))
        .route(
            "/api/v1/me/encryption-key",
            get(user::get_encryption_key_status)
                .post(user::store_encryption_key)
                .delete(user::reset_encryption_key),
        )
        .route(
            "/api/v1/me/tokens",
            get(tokens::list_tokens).post(tokens::create_token),
        )
        .route("/api/v1/me/tokens/:id", delete(tokens::revoke_token))
        .route("/api/v1/items", get(items::get_items))
        .route("/api/v1/items", put(items::put_items))
        .route("/api/v1/items/archive", get(items::get_archive))
        .route("/api/v1/items/archive", put(items::put_archive))
        .route("/api/v1/events", get(events::events))
        .route("/metrics", get(metrics_handler))
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
        .layer(cors)
        .layer(HttpMetricsLayer);

    let swagger_router: Router<()> = swagger_ui.into();

    if let Some(cfg) = oidc_config {
        use axum::error_handling::HandleErrorLayer;
        use axum_oidc::error::MiddlewareError;
        use axum_oidc::{EmptyAdditionalClaims, OidcAuthLayer, OidcLoginLayer};
        use tower::ServiceBuilder;
        use tower_sessions::{MemoryStore, SessionManagerLayer};

        let session_store = MemoryStore::default();
        let session_layer = SessionManagerLayer::new(session_store).with_secure(true);

        let app_base_url: axum::http::Uri = cfg.base_url.parse()?;

        let oidc_layer = OidcAuthLayer::<EmptyAdditionalClaims>::discover_client(
            app_base_url,
            cfg.issuer.clone(),
            cfg.client_id.clone(),
            Some(cfg.client_secret.clone()),
            vec![
                "openid".to_string(),
                "profile".to_string(),
                "email".to_string(),
            ],
        )
        .await?;

        let oidc_routes = Router::new()
            .route("/auth/oidc/login", get(crate::handlers::oidc::login))
            .layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(|e: MiddlewareError| async move {
                        e.into_response()
                    }))
                    .layer(OidcLoginLayer::<EmptyAdditionalClaims>::new()),
            );

        let app = main_routes
            .merge(oidc_routes)
            .layer(
                ServiceBuilder::new()
                    .layer(HandleErrorLayer::new(|e: MiddlewareError| async move {
                        e.into_response()
                    }))
                    .layer(oidc_layer),
            )
            .layer(axum::middleware::from_fn(strip_oidc_provider_params))
            .layer(session_layer)
            .with_state(state)
            .merge(swagger_router);

        Ok(app.fallback(crate::embedded_ui::serve_ui))
    } else {
        Ok(main_routes
            .with_state(state)
            .merge(swagger_router)
            .fallback(crate::embedded_ui::serve_ui))
    }
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let body = state.prometheus_handle.render();
    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}

fn build_cors_layer(origins: &[String]) -> CorsLayer {
    let cors = CorsLayer::new()
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    if origins.is_empty() {
        cors.allow_origin(AllowOrigin::exact(HeaderValue::from_static(
            "http://localhost",
        )))
    } else {
        let parsed: Vec<HeaderValue> = origins.iter().filter_map(|o| o.parse().ok()).collect();
        cors.allow_origin(AllowOrigin::list(parsed))
    }
}
