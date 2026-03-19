use base64::Engine;
use rand::Rng;
use sha2::{Digest, Sha256};

/// PAT prefix — enables GitHub-style secret scanning and prefix-based routing.
const PAT_PREFIX: &str = "tb_";

/// Generate a new Personal Access Token.
/// Returns `(raw_token, sha256_hex_hash, prefix)`.
pub fn generate_pat() -> (String, String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    let raw = format!(
        "{}{}",
        PAT_PREFIX,
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
    );
    let hash = hash_token(&raw);
    let prefix = raw.chars().take(12).collect();
    (raw, hash, prefix)
}

/// SHA-256 hash of a token string, returned as lowercase hex.
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Check whether a token string is a PAT (starts with `tb_`).
pub fn is_pat(token: &str) -> bool {
    token.starts_with(PAT_PREFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_pat_has_correct_prefix() {
        let (raw, _hash, prefix) = generate_pat();
        assert!(raw.starts_with("tb_"));
        assert_eq!(prefix.len(), 12);
        assert!(prefix.starts_with("tb_"));
    }

    #[test]
    fn hash_is_deterministic() {
        let h1 = hash_token("tb_test123");
        let h2 = hash_token("tb_test123");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // SHA-256 hex = 64 chars
    }

    #[test]
    fn different_tokens_produce_different_hashes() {
        let h1 = hash_token("tb_aaa");
        let h2 = hash_token("tb_bbb");
        assert_ne!(h1, h2);
    }

    #[test]
    fn is_pat_detection() {
        assert!(is_pat("tb_abc123"));
        assert!(!is_pat("some-session-token"));
        assert!(!is_pat(""));
    }
}
