-- Allow OIDC-created accounts to have no password (NULL = OIDC-only account).
-- Existing password-based accounts are unaffected.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Links an OIDC provider identity (provider + subject claim) to a taskbook user.
CREATE TABLE oidc_identities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   VARCHAR(64) NOT NULL,
    subject    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, subject)
);
