use axum::{
    extract::State,
    response::{Html, IntoResponse, Redirect},
    Extension,
};
use axum_oidc::{EmptyAdditionalClaims, OidcAccessToken, OidcClaims};
use base64::Engine;
use tower_sessions::Session;
use uuid::Uuid;

use crate::error::{Result, ServerError};
use crate::handlers::user::create_session;
use crate::router::{AppState, SpaRedirectUri, SPA_REDIRECT_SESSION_KEY};

pub async fn login(
    State(state): State<AppState>,
    session: Session,
    spa_redirect: Option<Extension<SpaRedirectUri>>,
    claims: OidcClaims<EmptyAdditionalClaims>,
    OidcAccessToken(access_token): OidcAccessToken,
) -> Result<impl IntoResponse> {
    let subject = claims.subject().to_string();
    let email = match claims.email().map(|e| e.to_string()) {
        Some(e) => Some(e),
        None => fetch_email_from_userinfo(state.oidc_issuer.as_deref(), &access_token).await,
    };
    let preferred_username = claims.preferred_username().map(|u| u.to_string());

    let provider = state
        .oidc_issuer
        .as_deref()
        .and_then(|url| url::Url::parse(url).ok())
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_else(|| "oidc".to_string());

    let (user_id, is_new_user, encryption_key) = find_or_create_oidc_user(
        &state.pool,
        &provider,
        &subject,
        email.as_deref(),
        preferred_username.as_deref(),
    )
    .await?;

    let token = create_session(&state.pool, user_id, state.session_expiry_days).await?;

    // Try to get redirect_uri: first from request extension (same request),
    // then from session (survives the OIDC round-trip to the identity provider).
    let redirect_uri: Option<String> = if let Some(Extension(SpaRedirectUri(uri))) = spa_redirect {
        Some(uri)
    } else {
        session
            .get::<String>(SPA_REDIRECT_SESSION_KEY)
            .await
            .ok()
            .flatten()
    };

    // Clean up the session key after reading it.
    let _ = session.remove::<String>(SPA_REDIRECT_SESSION_KEY).await;

    if let Some(redirect_uri) = redirect_uri {
        if is_allowed_redirect(&redirect_uri, &state.allowed_redirects) {
            let mut target = redirect_uri.clone();
            target.push_str("#token=");
            target.push_str(&token);
            if is_new_user {
                if let Some(key) = &encryption_key {
                    target.push_str("&encryption_key=");
                    target.push_str(key);
                }
                target.push_str("&new_user=true");
            }
            if !is_new_user {
                let has_key = sqlx::query_scalar::<_, Option<String>>(
                    "SELECT encryption_key_hash FROM users WHERE id = $1",
                )
                .bind(user_id)
                .fetch_one(&state.pool)
                .await
                .map_err(ServerError::Database)?
                .is_some();
                target.push_str("&encryption_key_available=");
                target.push_str(if has_key { "true" } else { "false" });
            }
            return Ok(Redirect::to(&target).into_response());
        }
    }

    Ok(Html(render_token_page(
        &token,
        is_new_user,
        encryption_key.as_deref(),
    ))
    .into_response())
}

/// Check if a redirect URI is allowed by matching against configured prefixes.
fn is_allowed_redirect(uri: &str, allowed: &[String]) -> bool {
    allowed
        .iter()
        .any(|allowed_prefix| uri.starts_with(allowed_prefix))
}

/// Fetch email from the OIDC userinfo endpoint using the access token.
/// Authelia (and some other providers) do not embed email in the ID token
/// but make it available via the userinfo endpoint.
async fn fetch_email_from_userinfo(
    oidc_issuer: Option<&str>,
    access_token: &str,
) -> Option<String> {
    let issuer = oidc_issuer?;
    // Derive userinfo URL from issuer — standard path per OpenID Connect spec
    let userinfo_url = format!("{}/api/oidc/userinfo", issuer.trim_end_matches('/'));
    let resp = reqwest::Client::new()
        .get(&userinfo_url)
        .bearer_auth(access_token)
        .send()
        .await
        .ok()?;
    let json: serde_json::Value = resp.json().await.ok()?;
    json["email"].as_str().map(|s| s.to_string())
}

async fn find_or_create_oidc_user(
    pool: &sqlx::PgPool,
    provider: &str,
    subject: &str,
    email: Option<&str>,
    preferred_username: Option<&str>,
) -> Result<(Uuid, bool, Option<String>)> {
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM oidc_identities WHERE provider = $1 AND subject = $2",
    )
    .bind(provider)
    .bind(subject)
    .fetch_optional(pool)
    .await
    .map_err(ServerError::Database)?;

    if let Some(user_id) = existing {
        return Ok((user_id, false, None));
    }

    let email = email.ok_or_else(|| {
        ServerError::Validation("OIDC provider did not supply an email address".to_string())
    })?;

    let username = find_unique_username(pool, preferred_username, email).await?;

    // Try to find an existing user by email first — this handles the case where a
    // user registered via CLI (username/password) and now logs in via OIDC.
    let existing_by_email: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await
            .map_err(ServerError::Database)?;

    let (user_id, is_new) = if let Some(uid) = existing_by_email {
        (uid, false)
    } else {
        let uid: Uuid = sqlx::query_scalar(
            "INSERT INTO users (username, email, password) VALUES ($1, $2, NULL) RETURNING id",
        )
        .bind(&username)
        .bind(email)
        .fetch_one(pool)
        .await
        .map_err(ServerError::Database)?;
        (uid, true)
    };

    // Link the OIDC identity to this user (new or existing).
    sqlx::query(
        "INSERT INTO oidc_identities (user_id, provider, subject) VALUES ($1, $2, $3) \
         ON CONFLICT (provider, subject) DO NOTHING",
    )
    .bind(user_id)
    .bind(provider)
    .bind(subject)
    .execute(pool)
    .await
    .map_err(ServerError::Database)?;

    if is_new {
        let raw_key = taskbook_common::encryption::generate_key();
        let key_b64 = base64::engine::general_purpose::STANDARD.encode(raw_key);
        Ok((user_id, true, Some(key_b64)))
    } else {
        Ok((user_id, false, None))
    }
}

async fn find_unique_username(
    pool: &sqlx::PgPool,
    preferred: Option<&str>,
    email: &str,
) -> Result<String> {
    let base = preferred
        .or_else(|| email.split('@').next())
        .unwrap_or("user");

    let base: String = base
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let base = if base.is_empty() {
        "user".to_string()
    } else {
        base
    };

    for i in 0u32..100 {
        let candidate = if i == 0 {
            base.clone()
        } else {
            format!("{}_{}", base, i + 1)
        };
        let taken: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
                .bind(&candidate)
                .fetch_one(pool)
                .await
                .map_err(ServerError::Database)?;
        if !taken {
            return Ok(candidate);
        }
    }

    Ok(format!("user_{}", &Uuid::new_v4().to_string()[..8]))
}

fn render_token_page(token: &str, is_new_user: bool, encryption_key: Option<&str>) -> String {
    let enc_key_section = if let Some(key) = encryption_key {
        format!(
            r#"
<div class="card warning">
  <h2>⚠️ Save your encryption key — it will NOT be shown again</h2>
  <p>Your taskbook data is encrypted client-side. This key is required to access it.</p>
  <div class="token-box" id="enc-key">{key}</div>
  <button onclick="copyText('enc-key', this)">Copy encryption key</button>
</div>"#
        )
    } else {
        String::new()
    };

    // is_new_user is currently unused but reserved for future first-login UX
    let _is_new_user = is_new_user;

    let cli_cmd =
        "tb --login --server https://taskbook.hochguertel.work --username &lt;your-username&gt;";

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Taskbook — Login successful</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 1rem; background: #0f1117; color: #e2e8f0; }}
    h1 {{ color: #68d391; }}
    .card {{ background: #1a202c; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; border: 1px solid #2d3748; }}
    .card.warning {{ border-color: #f6ad55; }}
    .token-box {{ font-family: monospace; background: #2d3748; padding: 0.75rem 1rem; border-radius: 4px; word-break: break-all; margin: 1rem 0; font-size: 0.9em; }}
    button {{ background: #4299e1; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }}
    button:hover {{ background: #3182ce; }}
    code {{ background: #2d3748; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.85em; }}
  </style>
</head>
<body>
  <h1>✅ Login successful</h1>
  {enc_key_section}
  <div class="card">
    <h2>Your session token</h2>
    <p>Use this token to configure the <code>tb</code> CLI:</p>
    <div class="token-box" id="session-token">{token}</div>
    <button onclick="copyText('session-token', this)">Copy token</button>
  </div>
  <div class="card">
    <h2>Configure the CLI</h2>
    <p>Run <code>tb --login</code> and enter your credentials when prompted, or edit <code>~/.taskbook.json</code> directly:</p>
    <div class="token-box">{cli_cmd}</div>
  </div>
  <script>
    function copyText(id, btn) {{
      navigator.clipboard.writeText(document.getElementById(id).textContent.trim());
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = btn.textContent.replace('Copied!', btn.dataset.orig || 'Copy'), 2000);
    }}
  </script>
</body>
</html>"#
    )
}
