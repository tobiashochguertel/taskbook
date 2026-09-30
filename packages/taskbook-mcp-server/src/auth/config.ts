/**
 * OAuth configuration for the MCP server.
 * Loaded from TB_MCP_OAUTH_* environment variables.
 */

export interface OAuthConfig {
  /** Public URL of this MCP server (e.g., https://mcp-taskbook.hochguertel.work) */
  publicUrl: string;
  /** Authelia OIDC issuer URL (e.g., https://auth.hochguertel.work) */
  issuerUrl: string;
  /** OAuth client ID registered in Authelia for MCP */
  clientId: string;
  /** OAuth client secret for the MCP client */
  clientSecret: string;
}

export interface OAuthEndpoints {
  authorization: string;
  token: string;
  introspection: string;
  userinfo: string;
}

/**
 * Load OAuth config from environment variables.
 * Returns null if OAuth is not configured (all vars optional).
 */
export function loadOAuthConfig(): OAuthConfig | null {
  const publicUrl = process.env.TB_MCP_PUBLIC_URL;
  const issuerUrl = process.env.TB_MCP_OAUTH_ISSUER;
  const clientId = process.env.TB_MCP_OAUTH_CLIENT_ID;
  const clientSecret = process.env.TB_MCP_OAUTH_CLIENT_SECRET;

  if (!publicUrl || !issuerUrl || !clientId || !clientSecret) {
    return null;
  }

  return {
    publicUrl: publicUrl.replace(/\/+$/, ""),
    issuerUrl: issuerUrl.replace(/\/+$/, ""),
    clientId,
    clientSecret,
  };
}

/**
 * Discover OIDC endpoints from the upstream issuer.
 * Fetches .well-known/openid-configuration and extracts relevant endpoints.
 */
export async function discoverOidcEndpoints(
  issuerUrl: string,
): Promise<OAuthEndpoints> {
  const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
  const resp = await fetch(discoveryUrl);
  if (!resp.ok) {
    throw new Error(
      `OIDC discovery failed: ${resp.status} ${resp.statusText} from ${discoveryUrl}`,
    );
  }
  const metadata = (await resp.json()) as Record<string, string>;

  const authorization = metadata.authorization_endpoint;
  const token = metadata.token_endpoint;
  const introspection = metadata.introspection_endpoint;
  const userinfo = metadata.userinfo_endpoint;

  if (!authorization || !token) {
    throw new Error("OIDC discovery missing required endpoints");
  }

  return {
    authorization,
    token,
    introspection: introspection ?? `${issuerUrl}/api/oidc/introspection`,
    userinfo: userinfo ?? `${issuerUrl}/api/oidc/userinfo`,
  };
}
