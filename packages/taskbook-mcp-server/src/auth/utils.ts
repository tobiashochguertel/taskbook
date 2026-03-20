/**
 * Shared OAuth utility functions.
 * Eliminates duplication of credential encoding, error responses,
 * and upstream token endpoint calls across auth modules.
 */

import type { OAuthConfig, OAuthEndpoints } from "./config.js";

/**
 * Encode client credentials as a Basic Authorization header value.
 * Used by routes.ts, token-verifier.ts for upstream Authelia communication.
 */
export function createBasicAuthHeader(
  clientId: string,
  clientSecret: string,
): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/**
 * Build a standardized OAuth error JSON response (RFC 6749 §5.2).
 */
export function oauthErrorResponse(
  error: string,
  description: string,
  status: number = 400,
): Response {
  return Response.json({ error, error_description: description }, { status });
}

/**
 * Fetch tokens from the upstream (Authelia) token endpoint.
 * Shared between authorization_code exchange and refresh_token grant.
 */
export async function fetchUpstreamToken(
  config: OAuthConfig,
  endpoints: OAuthEndpoints,
  body: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: createBasicAuthHeader(
          config.clientId,
          config.clientSecret,
        ),
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!resp.ok) {
      console.error(
        `[taskbook-mcp] Upstream token exchange failed: ${resp.status}`,
      );
      return null;
    }

    return (await resp.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("[taskbook-mcp] Upstream token exchange error:", err);
    return null;
  }
}
