/**
 * OAuth authorization flow state management.
 * Tracks pending authorization requests (PKCE, state, redirect_uri).
 */

import { randomBytes, createHash } from "node:crypto";

interface AuthorizationState {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  state: string;
  /** Our own state for the upstream (Authelia) request */
  upstreamState: string;
  createdAt: number;
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  /** Tokens received from Authelia for this authorization */
  upstreamAccessToken: string;
  upstreamRefreshToken?: string;
  expiresAt: number;
}

const AUTHORIZATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export class OAuthFlowManager {
  private pendingAuthorizations = new Map<string, AuthorizationState>();
  private authorizationCodes = new Map<string, AuthorizationCode>();
  /** Map upstream state → our state key for callback matching */
  private upstreamStateMap = new Map<string, string>();

  /**
   * Start an authorization flow.
   * Returns the upstream state to use when redirecting to Authelia.
   */
  startAuthorization(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope: string;
    state: string;
  }): string {
    const upstreamState = randomBytes(32).toString("hex");
    const key = `${params.clientId}:${params.state}`;

    this.pendingAuthorizations.set(key, {
      ...params,
      upstreamState,
      createdAt: Date.now(),
    });
    this.upstreamStateMap.set(upstreamState, key);

    // Cleanup expired entries periodically
    this.cleanupExpired();

    return upstreamState;
  }

  /**
   * Handle callback from Authelia.
   * Returns the original client redirect URI with an authorization code.
   */
  handleCallback(
    upstreamState: string,
    upstreamAccessToken: string,
    upstreamRefreshToken?: string,
  ): { redirectUri: string; code: string; state: string } | null {
    const key = this.upstreamStateMap.get(upstreamState);
    if (!key) return null;

    const pending = this.pendingAuthorizations.get(key);
    if (!pending) return null;

    // Check expiry
    if (Date.now() - pending.createdAt > AUTHORIZATION_TIMEOUT) {
      this.pendingAuthorizations.delete(key);
      this.upstreamStateMap.delete(upstreamState);
      return null;
    }

    // Generate authorization code
    const code = randomBytes(32).toString("hex");
    this.authorizationCodes.set(code, {
      code,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: pending.codeChallengeMethod,
      scope: pending.scope,
      upstreamAccessToken,
      upstreamRefreshToken,
      expiresAt: Date.now() + CODE_EXPIRY,
    });

    // Clean up pending state
    this.pendingAuthorizations.delete(key);
    this.upstreamStateMap.delete(upstreamState);

    return {
      redirectUri: pending.redirectUri,
      code,
      state: pending.state,
    };
  }

  /**
   * Exchange an authorization code for tokens.
   * Validates PKCE code_verifier against the stored code_challenge.
   */
  exchangeCode(
    code: string,
    clientId: string,
    codeVerifier: string,
    redirectUri: string,
  ): {
    accessToken: string;
    refreshToken?: string;
    scope: string;
  } | null {
    const entry = this.authorizationCodes.get(code);
    if (!entry) return null;

    // Validate
    if (entry.clientId !== clientId) return null;
    if (entry.redirectUri !== redirectUri) return null;
    if (Date.now() > entry.expiresAt) {
      this.authorizationCodes.delete(code);
      return null;
    }

    // PKCE S256 verification
    if (entry.codeChallengeMethod === "S256") {
      const expectedChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
      if (expectedChallenge !== entry.codeChallenge) {
        return null;
      }
    } else if (entry.codeChallengeMethod === "plain") {
      if (codeVerifier !== entry.codeChallenge) return null;
    }

    // Consume the code (one-time use)
    this.authorizationCodes.delete(code);

    return {
      accessToken: entry.upstreamAccessToken,
      refreshToken: entry.upstreamRefreshToken,
      scope: entry.scope,
    };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, state] of this.pendingAuthorizations) {
      if (now - state.createdAt > AUTHORIZATION_TIMEOUT) {
        this.upstreamStateMap.delete(state.upstreamState);
        this.pendingAuthorizations.delete(key);
      }
    }
    for (const [code, entry] of this.authorizationCodes) {
      if (now > entry.expiresAt) {
        this.authorizationCodes.delete(code);
      }
    }
  }
}
