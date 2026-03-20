pub mod dal;

use std::time::Duration;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{ConnectOptions, PgPool};
use tracing::log::LevelFilter;

use crate::constants;

/// Create a PostgreSQL connection pool with resilience settings.
///
/// Disables `extra_float_digits` startup parameter for PgBouncer compatibility.
pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let connect_options: PgConnectOptions = database_url
        .parse::<PgConnectOptions>()?
        .extra_float_digits(None)
        .log_slow_statements(
            LevelFilter::Warn,
            Duration::from_secs(constants::DB_SLOW_STATEMENT_THRESHOLD_SECS),
        );

    PgPoolOptions::new()
        .max_connections(constants::DB_MAX_CONNECTIONS)
        .acquire_timeout(Duration::from_secs(constants::DB_ACQUIRE_TIMEOUT_SECS))
        .idle_timeout(Duration::from_secs(constants::DB_IDLE_TIMEOUT_SECS))
        .max_lifetime(Duration::from_secs(constants::DB_MAX_LIFETIME_SECS))
        .connect_with(connect_options)
        .await
}
