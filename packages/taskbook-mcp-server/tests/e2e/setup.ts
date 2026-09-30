/**
 * E2E test setup — loads configuration from environment variables.
 * Tests skip gracefully if required variables are not set.
 */

export interface E2EConfig {
  mcpUrl: string;
  pat: string;
  serverUrl: string;
  token: string;
  encryptionKey: string;
}

export function loadE2EConfig(): E2EConfig | null {
  const mcpUrl = process.env.TB_TEST_MCP_URL;
  const pat = process.env.TB_TEST_PAT;
  const serverUrl = process.env.TB_TEST_SERVER_URL;
  const token = process.env.TB_TEST_TOKEN;
  const encryptionKey = process.env.TB_TEST_ENCRYPTION_KEY;

  if (!mcpUrl || !pat) {
    console.warn(
      "⏭  E2E tests skipped: set TB_TEST_MCP_URL and TB_TEST_PAT to run",
    );
    return null;
  }

  return {
    mcpUrl: mcpUrl.replace(/\/+$/, ""),
    pat,
    serverUrl: serverUrl ?? mcpUrl.replace("mcp-taskbook", "taskbook"),
    token: token ?? pat,
    encryptionKey: encryptionKey ?? "",
  };
}

/** MCP protocol requires both Accept types */
export const MCP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
};

/** Helper: make an authenticated fetch to the MCP server */
export async function mcpFetch(
  config: E2EConfig,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${config.mcpUrl}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.pat}`,
      ...MCP_HEADERS,
      ...options.headers,
    },
  });
}
