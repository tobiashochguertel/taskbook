-- Personal Access Tokens (PATs)
-- Named, long-lived API keys that users can create, list, and revoke.
-- Raw tokens are never stored; only SHA-256 hashes are persisted.

CREATE TABLE personal_access_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(128) NOT NULL,
    token_hash   VARCHAR(64) NOT NULL,
    token_prefix VARCHAR(12) NOT NULL,
    expires_at   TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_pat_token_hash ON personal_access_tokens(token_hash);
CREATE INDEX idx_pat_user_id ON personal_access_tokens(user_id);
