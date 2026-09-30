/**
 * In-memory OAuth client store for dynamic client registration (RFC 7591).
 * Stores registered OAuth clients with their metadata.
 */

import { randomUUID } from "node:crypto";

export interface OAuthClientInfo {
  client_id: string;
  client_secret?: string;
  client_secret_expires_at?: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: number;
}

export interface ClientRegistrationRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}

/** Sliding-window rate limiter keyed by an arbitrary string (e.g. IP). */
export class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private windowMs: number = 15 * 60 * 1000,
    private maxAttempts: number = 20,
  ) {}

  /** Returns true if the key is within limits, false if rate-limited. */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now >= entry.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxAttempts) {
      return false;
    }

    entry.count++;
    return true;
  }
}

export class OAuthClientStore {
  private clients = new Map<string, OAuthClientInfo>();
  private rateLimiter: RateLimiter;

  constructor(rateLimiter?: RateLimiter) {
    this.rateLimiter = rateLimiter ?? new RateLimiter();
  }

  getClient(clientId: string): OAuthClientInfo | undefined {
    return this.clients.get(clientId);
  }

  registerClient(
    request: ClientRegistrationRequest,
    clientIp: string,
  ): OAuthClientInfo | { error: string; status: number } {
    if (!this.rateLimiter.check(clientIp)) {
      return { error: "Too many registration attempts", status: 429 };
    }

    if (!request.redirect_uris || request.redirect_uris.length === 0) {
      return { error: "redirect_uris is required", status: 400 };
    }

    const clientId = randomUUID();
    const clientSecret = generateClientSecret();
    const authMethod =
      request.token_endpoint_auth_method ?? "client_secret_basic";

    const client: OAuthClientInfo = {
      client_id: clientId,
      client_secret: authMethod !== "none" ? clientSecret : undefined,
      client_secret_expires_at: 0,
      client_name: request.client_name,
      redirect_uris: request.redirect_uris,
      grant_types: request.grant_types ?? ["authorization_code"],
      response_types: request.response_types ?? ["code"],
      token_endpoint_auth_method: authMethod,
      created_at: Date.now(),
    };

    this.clients.set(clientId, client);
    console.log(
      `[taskbook-mcp] OAuth client registered: ${clientId} (${client.client_name ?? "unnamed"})`,
    );

    return client;
  }

  /** Validate that a redirect URI matches the client's registered URIs */
  validateRedirectUri(clientId: string, redirectUri: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    return client.redirect_uris.includes(redirectUri);
  }
}

function generateClientSecret(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64url")
    .slice(0, 48);
}
