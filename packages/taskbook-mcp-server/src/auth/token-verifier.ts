/**
 * Token verification for MCP server.
 * Supports both PAT (tb_* prefix) and OAuth access tokens.
 */

import type { OAuthConfig, OAuthEndpoints } from "./config.js";

export interface AuthInfo {
  type: "pat" | "oauth";
  token: string;
  subject?: string;
  scopes?: string[];
  expiresAt?: number;
}

/**
 * Verify a Bearer token.
 * - PAT tokens (tb_*) are validated against the taskbook server API.
 * - OAuth tokens are validated via Authelia's introspection endpoint.
 */
export async function verifyToken(
  token: string,
  taskbookServerUrl: string,
  oauthConfig: OAuthConfig | null,
  oauthEndpoints: OAuthEndpoints | null,
): Promise<AuthInfo | null> {
  if (token.startsWith("tb_")) {
    return verifyPat(token, taskbookServerUrl);
  }

  if (oauthConfig && oauthEndpoints) {
    return verifyOAuthToken(token, oauthConfig, oauthEndpoints);
  }

  return null;
}

/** Verify a Personal Access Token against the taskbook server */
async function verifyPat(
  token: string,
  serverUrl: string,
): Promise<AuthInfo | null> {
  try {
    const resp = await fetch(`${serverUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data = (await resp.json()) as { id?: string; email?: string };
      return {
        type: "pat",
        token,
        subject: data.email ?? data.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Verify an OAuth access token via Authelia's introspection endpoint */
async function verifyOAuthToken(
  token: string,
  config: OAuthConfig,
  endpoints: OAuthEndpoints,
): Promise<AuthInfo | null> {
  try {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString("base64");

    const resp = await fetch(endpoints.introspection, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token }).toString(),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      active?: boolean;
      sub?: string;
      scope?: string;
      exp?: number;
    };

    if (!data.active) return null;

    return {
      type: "oauth",
      token,
      subject: data.sub,
      scopes: data.scope?.split(" "),
      expiresAt: data.exp,
    };
  } catch {
    return null;
  }
}
