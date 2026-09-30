import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface TaskbookConfig {
  serverUrl: string;
  token: string;
  encryptionKey: string;
}

export interface McpServerConfig {
  taskbook: TaskbookConfig;
  port: number;
  host: string;
  transport: "stdio" | "http";
}

interface TaskbookJsonFile {
  sync?: {
    server_url?: string;
    token?: string;
  };
  encryption_key?: string;
}

/**
 * Load taskbook config from ~/.taskbook.json (same file the CLI uses).
 * Falls back to environment variables.
 */
export function loadTaskbookConfig(): TaskbookConfig {
  const envUrl = process.env.TB_SERVER_URL;
  const envToken = process.env.TB_TOKEN;
  const envKey = process.env.TB_ENCRYPTION_KEY;

  if (envUrl && envToken && envKey) {
    return { serverUrl: envUrl, token: envToken, encryptionKey: envKey };
  }

  const configPath =
    process.env.TB_CONFIG_PATH ?? join(homedir(), ".taskbook.json");

  if (!existsSync(configPath)) {
    throw new Error(
      `Taskbook config not found at ${configPath}. ` +
        "Run 'tb --login' or set TB_SERVER_URL, TB_TOKEN, TB_ENCRYPTION_KEY env vars.",
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const config: TaskbookJsonFile = JSON.parse(raw);

  const serverUrl = envUrl ?? config.sync?.server_url;
  const token = envToken ?? config.sync?.token;
  const encryptionKey = envKey ?? config.encryption_key;

  if (!serverUrl) throw new Error("Missing server URL in taskbook config");
  if (!token) throw new Error("Missing auth token in taskbook config");
  if (!encryptionKey)
    throw new Error("Missing encryption key in taskbook config");

  return { serverUrl, token, encryptionKey };
}

export function loadMcpConfig(): Omit<McpServerConfig, "taskbook"> & {
  taskbook?: TaskbookConfig;
} {
  const transport =
    (process.env.TB_MCP_TRANSPORT as "stdio" | "http") ?? "stdio";
  const port = Number.parseInt(process.env.TB_MCP_PORT ?? "3100", 10);
  const host = process.env.TB_MCP_HOST ?? "127.0.0.1";

  return { port, host, transport };
}
