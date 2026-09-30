/**
 * E2E tests — OAuth metadata and dynamic client registration
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { loadE2EConfig, type E2EConfig } from "./setup";

let config: E2EConfig | null;

beforeAll(() => {
  config = loadE2EConfig();
});

describe("OAuth metadata", () => {
  test("GET /.well-known/oauth-authorization-server returns valid metadata", async () => {
    if (!config) return;

    const resp = await fetch(
      `${config.mcpUrl}/.well-known/oauth-authorization-server`,
    );
    expect(resp.status).toBe(200);

    const metadata = await resp.json();
    expect(metadata.issuer).toBe(config.mcpUrl);
    expect(metadata.authorization_endpoint).toContain("/oauth/authorize");
    expect(metadata.token_endpoint).toContain("/oauth/token");
    expect(metadata.registration_endpoint).toContain("/oauth/register");
    expect(metadata.response_types_supported).toContain("code");
    expect(metadata.grant_types_supported).toContain("authorization_code");
    expect(metadata.code_challenge_methods_supported).toContain("S256");
  });

  test("GET /.well-known/oauth-protected-resource returns resource metadata", async () => {
    if (!config) return;

    const resp = await fetch(
      `${config.mcpUrl}/.well-known/oauth-protected-resource`,
    );
    expect(resp.status).toBe(200);

    const metadata = await resp.json();
    expect(metadata.resource).toContain("/mcp");
    expect(metadata.authorization_servers).toBeArray();
    expect(metadata.bearer_methods_supported).toContain("header");
  });
});

describe("Dynamic client registration", () => {
  test("POST /oauth/register creates a client", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "e2e-test-client",
        redirect_uris: ["http://localhost:18999/callback"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    });

    expect(resp.status).toBe(201);
    const client = await resp.json();
    expect(client.client_id).toBeTruthy();
    expect(client.client_secret).toBeTruthy();
    expect(client.redirect_uris).toContain("http://localhost:18999/callback");
  });

  test("POST /oauth/register rejects missing redirect_uris", async () => {
    if (!config) return;

    const resp = await fetch(`${config.mcpUrl}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "bad-client" }),
    });

    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("invalid_client_metadata");
  });
});
