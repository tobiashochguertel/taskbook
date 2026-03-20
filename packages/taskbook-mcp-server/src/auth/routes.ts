/**
 * OAuth route handlers for Bun's native HTTP server.
 * Implements RFC 8414 (metadata), RFC 7591 (dynamic registration),
 * and authorization code flow delegating to Authelia.
 */

import type { OAuthConfig, OAuthEndpoints } from "./config.js";
import { OAuthClientStore } from "./client-store.js";
import { OAuthFlowManager } from "./flow-manager.js";

export class OAuthRouter {
  private clientStore = new OAuthClientStore();
  private flowManager = new OAuthFlowManager();

  constructor(
    private config: OAuthConfig,
    private endpoints: OAuthEndpoints,
  ) {}

  /**
   * Handle an incoming OAuth-related request.
   * Returns a Response if the route matches, null otherwise.
   */
  async handleRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/.well-known/oauth-authorization-server":
        return this.handleMetadata();
      case "/.well-known/oauth-protected-resource":
        return this.handleResourceMetadata();
      case "/oauth/register":
        return req.method === "POST"
          ? this.handleRegister(req)
          : methodNotAllowed();
      case "/oauth/authorize":
        return req.method === "GET"
          ? this.handleAuthorize(req)
          : methodNotAllowed();
      case "/oauth/callback":
        return req.method === "GET"
          ? this.handleCallback(req)
          : methodNotAllowed();
      case "/oauth/token":
        return req.method === "POST"
          ? this.handleToken(req)
          : methodNotAllowed();
      default:
        return null;
    }
  }

  /** RFC 8414 — Authorization Server Metadata */
  private handleMetadata(): Response {
    const baseUrl = this.config.publicUrl;
    return Response.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "none"],
      scopes_supported: ["openid", "profile", "email"],
    });
  }

  /** RFC 9728 — Protected Resource Metadata */
  private handleResourceMetadata(): Response {
    const baseUrl = this.config.publicUrl;
    return Response.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: ["openid", "profile", "email"],
    });
  }

  /** RFC 7591 — Dynamic Client Registration */
  private async handleRegister(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      const result = this.clientStore.registerClient(
        {
          client_name: body.client_name as string | undefined,
          redirect_uris: body.redirect_uris as string[],
          grant_types: body.grant_types as string[] | undefined,
          response_types: body.response_types as string[] | undefined,
          token_endpoint_auth_method:
            body.token_endpoint_auth_method as string | undefined,
        },
        clientIp,
      );

      if ("error" in result) {
        return Response.json(
          { error: "invalid_client_metadata", error_description: result.error },
          { status: result.status },
        );
      }

      return Response.json(result, { status: 201 });
    } catch {
      return Response.json(
        { error: "invalid_request", error_description: "Invalid JSON body" },
        { status: 400 },
      );
    }
  }

  /** Authorization endpoint — redirects to Authelia */
  private handleAuthorize(req: Request): Response {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const codeChallenge = url.searchParams.get("code_challenge");
    const codeChallengeMethod =
      url.searchParams.get("code_challenge_method") ?? "S256";
    const state = url.searchParams.get("state");
    const scope = url.searchParams.get("scope") ?? "openid profile email";

    // Validate required parameters
    if (!clientId || !redirectUri || !codeChallenge || !state) {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameters: client_id, redirect_uri, code_challenge, state",
        },
        { status: 400 },
      );
    }

    // Validate client exists
    const client = this.clientStore.getClient(clientId);
    if (!client) {
      return Response.json(
        { error: "invalid_client", error_description: "Unknown client_id" },
        { status: 400 },
      );
    }

    // Validate redirect URI
    if (!this.clientStore.validateRedirectUri(clientId, redirectUri)) {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "redirect_uri not registered",
        },
        { status: 400 },
      );
    }

    // Only S256 supported
    if (codeChallengeMethod !== "S256") {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Only S256 code_challenge_method is supported",
        },
        { status: 400 },
      );
    }

    // Start the flow and get upstream state
    const upstreamState = this.flowManager.startAuthorization({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
      state,
    });

    // Build Authelia authorization URL
    const autheliaUrl = new URL(this.endpoints.authorization);
    autheliaUrl.searchParams.set("client_id", this.config.clientId);
    autheliaUrl.searchParams.set("response_type", "code");
    autheliaUrl.searchParams.set(
      "redirect_uri",
      `${this.config.publicUrl}/oauth/callback`,
    );
    autheliaUrl.searchParams.set("scope", scope);
    autheliaUrl.searchParams.set("state", upstreamState);

    return Response.redirect(autheliaUrl.toString(), 302);
  }

  /** OAuth callback from Authelia */
  private async handleCallback(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const desc =
        url.searchParams.get("error_description") ?? "Authorization denied";
      return new Response(
        `Authorization failed: ${error} — ${desc}`,
        { status: 400 },
      );
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Exchange upstream code for tokens with Authelia
    const tokenResult = await this.exchangeUpstreamCode(code);
    if (!tokenResult) {
      return new Response("Failed to exchange authorization code", {
        status: 500,
      });
    }

    // Complete our flow: generate our own authorization code for the MCP client
    const result = this.flowManager.handleCallback(
      state,
      tokenResult.access_token,
      tokenResult.refresh_token,
    );

    if (!result) {
      return new Response("Invalid or expired authorization state", {
        status: 400,
      });
    }

    // Redirect back to the MCP client with our authorization code
    const redirectUrl = new URL(result.redirectUri);
    redirectUrl.searchParams.set("code", result.code);
    redirectUrl.searchParams.set("state", result.state);

    return Response.redirect(redirectUrl.toString(), 302);
  }

  /** Token endpoint — exchange authorization code for access token */
  private async handleToken(req: Request): Promise<Response> {
    const contentType = req.headers.get("content-type") ?? "";
    let params: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      params = new URLSearchParams(await req.text());
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, string>;
      params = new URLSearchParams(body);
    } else {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Content-Type must be application/x-www-form-urlencoded or application/json",
        },
        { status: 400 },
      );
    }

    const grantType = params.get("grant_type");

    if (grantType === "authorization_code") {
      return this.handleAuthorizationCodeGrant(params, req);
    }

    if (grantType === "refresh_token") {
      return this.handleRefreshTokenGrant(params);
    }

    return Response.json(
      {
        error: "unsupported_grant_type",
        error_description: "Supported: authorization_code, refresh_token",
      },
      { status: 400 },
    );
  }

  private handleAuthorizationCodeGrant(
    params: URLSearchParams,
    req: Request,
  ): Response {
    const code = params.get("code");
    const codeVerifier = params.get("code_verifier");
    const redirectUri = params.get("redirect_uri");
    const clientId =
      params.get("client_id") ?? this.extractClientIdFromBasicAuth(req);

    if (!code || !codeVerifier || !redirectUri || !clientId) {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Missing required parameters",
        },
        { status: 400 },
      );
    }

    const result = this.flowManager.exchangeCode(
      code,
      clientId,
      codeVerifier,
      redirectUri,
    );

    if (!result) {
      return Response.json(
        {
          error: "invalid_grant",
          error_description: "Invalid or expired authorization code",
        },
        { status: 400 },
      );
    }

    return Response.json({
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: result.refreshToken,
      scope: result.scope,
    });
  }

  private async handleRefreshTokenGrant(
    params: URLSearchParams,
  ): Promise<Response> {
    const refreshToken = params.get("refresh_token");
    if (!refreshToken) {
      return Response.json(
        {
          error: "invalid_request",
          error_description: "Missing refresh_token",
        },
        { status: 400 },
      );
    }

    // Forward refresh to Authelia
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    try {
      const resp = await fetch(this.endpoints.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!resp.ok) {
        return Response.json(
          {
            error: "invalid_grant",
            error_description: "Refresh token exchange failed",
          },
          { status: 400 },
        );
      }

      const data = (await resp.json()) as Record<string, unknown>;
      return Response.json({
        access_token: data.access_token,
        token_type: "Bearer",
        expires_in: data.expires_in ?? 3600,
        refresh_token: data.refresh_token ?? refreshToken,
        scope: data.scope,
      });
    } catch {
      return Response.json(
        {
          error: "server_error",
          error_description: "Failed to refresh token",
        },
        { status: 500 },
      );
    }
  }

  /** Exchange an authorization code at Authelia's token endpoint */
  private async exchangeUpstreamCode(
    code: string,
  ): Promise<{ access_token: string; refresh_token?: string } | null> {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    try {
      const resp = await fetch(this.endpoints.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${this.config.publicUrl}/oauth/callback`,
        }).toString(),
      });

      if (!resp.ok) {
        console.error(
          `[taskbook-mcp] Upstream token exchange failed: ${resp.status}`,
        );
        return null;
      }

      return (await resp.json()) as {
        access_token: string;
        refresh_token?: string;
      };
    } catch (err) {
      console.error("[taskbook-mcp] Upstream token exchange error:", err);
      return null;
    }
  }

  private extractClientIdFromBasicAuth(req: Request): string | null {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return null;
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
      const [clientId] = decoded.split(":", 2);
      return clientId || null;
    } catch {
      return null;
    }
  }
}

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}
