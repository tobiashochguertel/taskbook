use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 24 hours
const GITHUB_API_URL: &str =
    "https://api.github.com/repos/tobiashochguertel/taskbook/releases/latest";

fn state_path() -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".taskbook");
    dir.join(".update-check")
}

fn should_check() -> bool {
    let path = state_path();
    match fs::metadata(&path) {
        Ok(meta) => match meta.modified() {
            Ok(modified) => modified.elapsed().unwrap_or(CHECK_INTERVAL) >= CHECK_INTERVAL,
            Err(_) => true,
        },
        Err(_) => true,
    }
}

fn touch_state() {
    let path = state_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, format!("{}", now_secs()));
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Check for updates in the background (non-blocking).
/// Prints a notice to stderr if a newer version is available.
pub fn check_for_updates() {
    if !should_check() {
        return;
    }

    // Run the check in a background thread so it doesn't block startup
    std::thread::spawn(|| {
        if let Some(latest) = fetch_latest_version() {
            let current = env!("CARGO_PKG_VERSION");
            if is_newer(&latest, current) {
                eprintln!(
                    "\n  Update available: {} → {}\n  Run: download from https://github.com/tobiashochguertel/taskbook/releases/latest\n",
                    current, latest
                );
            }
        }
        touch_state();
    });
}

fn fetch_latest_version() -> Option<String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("tb-update-checker")
        .build()
        .ok()?;

    let resp = client.get(GITHUB_API_URL).send().ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let body: serde_json::Value = resp.json().ok()?;
    let tag = body.get("tag_name")?.as_str()?;
    // Strip leading 'v' from tag (e.g., "v1.7.0" → "1.7.0")
    Some(tag.strip_prefix('v').unwrap_or(tag).to_string())
}

/// Returns true if `latest` is a newer semver than `current`.
fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |s: &str| -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = s.split('.').collect();
        if parts.len() != 3 {
            return None;
        }
        Some((
            parts[0].parse().ok()?,
            parts[1].parse().ok()?,
            parts[2].parse().ok()?,
        ))
    };

    match (parse(latest), parse(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer() {
        assert!(is_newer("1.8.0", "1.7.0"));
        assert!(is_newer("2.0.0", "1.7.0"));
        assert!(is_newer("1.7.1", "1.7.0"));
        assert!(!is_newer("1.7.0", "1.7.0"));
        assert!(!is_newer("1.6.0", "1.7.0"));
        assert!(!is_newer("0.3.0", "1.7.0"));
    }

    #[test]
    fn test_is_newer_invalid() {
        assert!(!is_newer("invalid", "1.7.0"));
        assert!(!is_newer("1.7.0", "invalid"));
    }
}
