/**
 * Browser-based E2E tests for the complete OAuth authorization flow.
 *
 * Tests the full cycle:
 *   1. Dynamic client registration (RFC 7591)
 *   2. PKCE code challenge generation (S256)
 *   3. Authorization redirect → Authelia login
 *   4. Callback with authorization code (captured by local HTTP server)
 *   5. Token exchange
 *   6. Authenticated MCP access with OAuth token
 *
 * Environment variables (skip if missing):
 *   TB_MCP_URL          — MCP server URL (default: https://mcp-taskbook.hochguertel.work)
 *   TB_AUTH_URL          — Authelia URL (default: https://auth.hochguertel.work)
 *   TB_TEST_USERNAME     — Authelia test user
 *   TB_TEST_PASSWORD     — Authelia test password
 */

import { test, expect, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";

/* ────────────────── Config ────────────────── */

const MCP_URL =
  process.env.TB_MCP_URL ?? "https://mcp-taskbook.hochguertel.work";
const AUTH_URL =
  process.env.TB_AUTH_URL ?? "https://auth.hochguertel.work";
const TEST_USER = process.env.TB_TEST_USERNAME ?? "";
const TEST_PASS = process.env.TB_TEST_PASSWORD ?? "";

const SKIP = !TEST_USER || !TEST_PASS;
const CALLBACK_PORT = 19876;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

/* ────────────────── PKCE Helpers ────────────────── */

function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64url")
    .replace(/[^A-Za-z0-9\-._~]/g, "")
    .slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return randomBytes(16).toString("hex");
}

/* ────────────────── Local Callback Server ────────────────── */

interface CallbackResult {
  code: string;
  state: string;
}

/**
 * Starts a temporary HTTP server on CALLBACK_PORT to capture the OAuth
 * callback redirect. This is necessary because `page.route()` cannot
 * intercept cross-origin 302 redirect chains — the browser follows
 * server-side redirects at the network level before Playwright routing.
 */
function startCallbackServer(): Promise<{
  server: Server;
  getResult: () => Promise<CallbackResult>;
}> {
  return new Promise((resolveServer) => {
    let resolveCallback: (value: CallbackResult) => void;
    const resultPromise = new Promise<CallbackResult>((r) => {
      resolveCallback = r;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>OAuth callback captured</body></html>");

      if (code && state) {
        resolveCallback({ code, state });
      }
    });

    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      resolveServer({ server, getResult: () => resultPromise });
    });
  });
}

/* ────────────────── Shared: Register Client ────────────────── */

interface RegisteredClient {
  client_id: string;
  client_secret: string;
}

async function registerTestClient(): Promise<RegisteredClient> {
  const resp = await fetch(`${MCP_URL}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: `e2e-browser-${Date.now()}`,
      redirect_uris: [CALLBACK_URL],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_basic",
    }),
  });
  expect(resp.status).toBe(201);
  const data = (await resp.json()) as RegisteredClient;
  expect(data.client_id).toBeTruthy();
  return data;
}

/* ────────────────── Shared: Login to Authelia ────────────────── */

async function loginToAuthelia(page: Page): Promise<void> {
  await page.waitForSelector("input#username-textfield", { timeout: 15_000 });
  await page.locator("input#username-textfield").fill(TEST_USER);
  await page.locator("input#password-textfield").fill(TEST_PASS);
  await page.locator("button#sign-in-button").click();
}

/* ────────────────── Shared: OAuth flow helper ────────────────── */

interface OAuthFlowResult {
  code: string;
  state: string;
  codeVerifier: string;
  server: Server;
}

/**
 * Runs the browser-based OAuth flow:
 * 1. Starts a local HTTP server to capture the callback
 * 2. Navigates to /oauth/authorize
 * 3. Logs in at Authelia (or auto-consents if session exists)
 * 4. Waits for the callback server to receive the authorization code
 *
 * Caller must close the returned server when done.
 */
async function runOAuthBrowserFlow(
  page: Page,
  client: RegisteredClient,
): Promise<OAuthFlowResult> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const { server, getResult } = await startCallbackServer();

  // Build and navigate to authorization URL
  const authorizeUrl = new URL(`${MCP_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", client.client_id);
  authorizeUrl.searchParams.set("redirect_uri", CALLBACK_URL);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "openid profile email");

  await page.goto(authorizeUrl.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });

  // Login to Authelia if redirected there
  if (page.url().includes("auth.hochguertel.work")) {
    await loginToAuthelia(page);
  }

  // Wait for the callback server to receive the authorization code
  const result = await Promise.race([
    getResult(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("OAuth callback timeout after 30s")),
        30_000,
      ),
    ),
  ]);

  expect(result.code).toBeTruthy();
  expect(result.state).toBe(state);

  return { code: result.code, state: result.state, codeVerifier, server };
}

/* ────────────────── Shared: Token exchange ────────────────── */

function basicAuthHeader(clientId: string, secret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
}

async function exchangeCodeForToken(
  client: RegisteredClient,
  code: string,
  codeVerifier: string,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${MCP_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(client.client_id, client.client_secret),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: CALLBACK_URL,
      client_id: client.client_id,
    }).toString(),
  });

  expect(resp.status).toBe(200);
  return (await resp.json()) as Record<string, unknown>;
}

/* ────────────────── Tests ────────────────── */

test.describe("OAuth browser flow", () => {
  test.skip(SKIP, "TB_TEST_USERNAME / TB_TEST_PASSWORD not set");

  let client: RegisteredClient;

  test.beforeAll(async () => {
    client = await registerTestClient();
  });

  test("Full OAuth flow: authorize → login → callback → token → MCP access", async ({
    page,
  }) => {
    const { code, codeVerifier, server } = await runOAuthBrowserFlow(
      page,
      client,
    );

    try {
      // Exchange code for token
      const tokenData = await exchangeCodeForToken(client, code, codeVerifier);
      expect(tokenData.access_token).toBeTruthy();
      expect(tokenData.token_type).toBe("Bearer");

      const accessToken = tokenData.access_token as string;

      // Use OAuth token to access MCP endpoint
      const mcpResp = await fetch(`${MCP_URL}/mcp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "e2e-oauth-test", version: "1.0" },
          },
        }),
      });

      expect(mcpResp.status).toBe(200);

      // Parse SSE response
      const sseText = await mcpResp.text();
      const dataLine = sseText
        .split("\n")
        .find((l) => l.startsWith("data: "));
      expect(dataLine).toBeTruthy();

      const mcpResult = JSON.parse(dataLine!.replace("data: ", ""));
      expect(mcpResult.result.serverInfo.name).toBe("taskbook-mcp");
    } finally {
      server.close();
    }
  });

  test("Refresh token exchange returns new access token", async ({ page }) => {
    // Register a fresh client that requests refresh_token grant
    const freshClient = await registerTestClient();

    const { code, codeVerifier, server } = await runOAuthBrowserFlow(
      page,
      freshClient,
    );

    try {
      // Exchange for tokens
      const tokenData = await exchangeCodeForToken(
        freshClient,
        code,
        codeVerifier,
      );
      const refreshToken = tokenData.refresh_token as string | undefined;

      // If Authelia doesn't return a refresh token for this grant, skip gracefully
      if (!refreshToken) {
        test.skip(true, "Authelia did not issue a refresh_token for this flow");
        return;
      }

      // Use refresh token to get new access token
      const refreshResp = await fetch(`${MCP_URL}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: basicAuthHeader(
            freshClient.client_id,
            freshClient.client_secret,
          ),
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: freshClient.client_id,
        }).toString(),
      });

      expect(refreshResp.status).toBe(200);
      const refreshData = (await refreshResp.json()) as Record<
        string,
        unknown
      >;
      expect(refreshData.access_token).toBeTruthy();
      expect(refreshData.token_type).toBe("Bearer");
    } finally {
      server.close();
    }
  });
});
