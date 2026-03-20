//! Data access layer — centralised SQL queries for the taskbook server.

use chrono::{DateTime, Utc};
use sqlx::postgres::PgQueryResult;
use uuid::Uuid;

// ── Users ───────────────────────────────────────────────────────────────

pub async fn insert_user<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    username: &str,
    email: &str,
    password_hash: Option<&str>,
) -> sqlx::Result<Uuid> {
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .fetch_one(executor)
    .await
}

pub async fn find_user_credentials<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    username: &str,
) -> sqlx::Result<Option<(Uuid, Option<String>)>> {
    sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT id, password FROM users WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(executor)
    .await
}

pub async fn get_user_profile<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<(String, String)> {
    sqlx::query_as::<_, (String, String)>("SELECT username, email FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(executor)
        .await
}

pub async fn update_username<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    username: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET username = $1 WHERE id = $2")
        .bind(username)
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn get_encryption_key_hash<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<Option<String>> {
    sqlx::query_scalar::<_, Option<String>>("SELECT encryption_key_hash FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(executor)
        .await
}

pub async fn set_encryption_key_hash<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    hash: &str,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET encryption_key_hash = $1 WHERE id = $2")
        .bind(hash)
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn clear_encryption_key_hash<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET encryption_key_hash = NULL WHERE id = $1")
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn find_user_by_email<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    email: &str,
) -> sqlx::Result<Option<Uuid>> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(executor)
        .await
}

pub async fn username_exists<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    username: &str,
) -> sqlx::Result<bool> {
    sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
        .bind(username)
        .fetch_one(executor)
        .await
}

// ── Sessions ────────────────────────────────────────────────────────────

pub async fn insert_session<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    token: &str,
    expires_at: DateTime<Utc>,
) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(token)
        .bind(expires_at)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn delete_user_sessions<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn find_session_user<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    token: &str,
    now: DateTime<Utc>,
) -> sqlx::Result<Option<(Uuid,)>> {
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM sessions WHERE token = $1 AND expires_at > $2",
    )
    .bind(token)
    .bind(now)
    .fetch_optional(executor)
    .await
}

// ── Items ───────────────────────────────────────────────────────────────

pub async fn fetch_items<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    archived: bool,
) -> sqlx::Result<Vec<(String, Vec<u8>, Vec<u8>)>> {
    sqlx::query_as::<_, (String, Vec<u8>, Vec<u8>)>(
        "SELECT item_key, data, nonce FROM items WHERE user_id = $1 AND archived = $2",
    )
    .bind(user_id)
    .bind(archived)
    .fetch_all(executor)
    .await
}

pub async fn delete_all_user_items<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM items WHERE user_id = $1")
        .bind(user_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn acquire_advisory_lock<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    lock_key: i64,
) -> sqlx::Result<()> {
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(lock_key)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn delete_category_items<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    archived: bool,
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM items WHERE user_id = $1 AND archived = $2")
        .bind(user_id)
        .bind(archived)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn delete_items_not_in_set<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    archived: bool,
    keep_keys: &[&str],
) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM items WHERE user_id = $1 AND archived = $2 AND item_key != ALL($3)")
        .bind(user_id)
        .bind(archived)
        .bind(keep_keys)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn upsert_item<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    key: &str,
    data: &[u8],
    nonce: &[u8],
    archived: bool,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO items (user_id, item_key, data, nonce, archived)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, item_key, archived)
         DO UPDATE SET data = EXCLUDED.data, nonce = EXCLUDED.nonce, updated_at = NOW()",
    )
    .bind(user_id)
    .bind(key)
    .bind(data)
    .bind(nonce)
    .bind(archived)
    .execute(executor)
    .await?;
    Ok(())
}

// ── Personal Access Tokens ──────────────────────────────────────────────

pub async fn find_valid_pat<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    token_hash: &str,
    now: DateTime<Utc>,
) -> sqlx::Result<Option<(Uuid, Uuid)>> {
    sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT id, user_id FROM personal_access_tokens \
         WHERE token_hash = $1 AND (expires_at IS NULL OR expires_at > $2)",
    )
    .bind(token_hash)
    .bind(now)
    .fetch_optional(executor)
    .await
}

pub async fn touch_pat_last_used<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    pat_id: Uuid,
    now: DateTime<Utc>,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE personal_access_tokens SET last_used_at = $1 WHERE id = $2")
        .bind(now)
        .bind(pat_id)
        .execute(executor)
        .await?;
    Ok(())
}

pub async fn insert_pat<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    name: &str,
    token_hash: &str,
    token_prefix: &str,
    expires_at: Option<DateTime<Utc>>,
) -> sqlx::Result<(Uuid, DateTime<Utc>)> {
    sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        r#"INSERT INTO personal_access_tokens (user_id, name, token_hash, token_prefix, expires_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, created_at"#,
    )
    .bind(user_id)
    .bind(name)
    .bind(token_hash)
    .bind(token_prefix)
    .bind(expires_at)
    .fetch_one(executor)
    .await
}

#[allow(clippy::type_complexity)]
pub async fn list_user_pats<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<
    Vec<(
        Uuid,
        String,
        String,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
        DateTime<Utc>,
    )>,
> {
    sqlx::query_as::<
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
    .bind(user_id)
    .fetch_all(executor)
    .await
}

pub async fn delete_pat<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<PgQueryResult> {
    sqlx::query("DELETE FROM personal_access_tokens WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(executor)
        .await
}

// ── OIDC ────────────────────────────────────────────────────────────────

pub async fn find_oidc_identity<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    provider: &str,
    subject: &str,
) -> sqlx::Result<Option<Uuid>> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM oidc_identities WHERE provider = $1 AND subject = $2",
    )
    .bind(provider)
    .bind(subject)
    .fetch_optional(executor)
    .await
}

pub async fn link_oidc_identity<'e, E: sqlx::PgExecutor<'e>>(
    executor: E,
    user_id: Uuid,
    provider: &str,
    subject: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO oidc_identities (user_id, provider, subject) VALUES ($1, $2, $3) \
         ON CONFLICT (provider, subject) DO NOTHING",
    )
    .bind(user_id)
    .bind(provider)
    .bind(subject)
    .execute(executor)
    .await?;
    Ok(())
}

// ── Health ───────────────────────────────────────────────────────────────

pub async fn health_check<'e, E: sqlx::PgExecutor<'e>>(executor: E) -> sqlx::Result<()> {
    sqlx::query("SELECT 1").execute(executor).await?;
    Ok(())
}
