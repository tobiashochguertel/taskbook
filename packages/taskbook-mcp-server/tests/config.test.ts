import { describe, expect, test } from "bun:test";
import { loadTaskbookConfig, loadMcpConfig } from "../src/config.js";

describe("config", () => {
  test("loadMcpConfig returns defaults when no env vars set", () => {
    const orig = {
      transport: process.env.TB_MCP_TRANSPORT,
      port: process.env.TB_MCP_PORT,
      host: process.env.TB_MCP_HOST,
    };

    delete process.env.TB_MCP_TRANSPORT;
    delete process.env.TB_MCP_PORT;
    delete process.env.TB_MCP_HOST;

    try {
      const cfg = loadMcpConfig();
      expect(cfg.transport).toBe("stdio");
      expect(cfg.port).toBe(3100);
      expect(cfg.host).toBe("127.0.0.1");
    } finally {
      if (orig.transport) process.env.TB_MCP_TRANSPORT = orig.transport;
      if (orig.port) process.env.TB_MCP_PORT = orig.port;
      if (orig.host) process.env.TB_MCP_HOST = orig.host;
    }
  });

  test("loadMcpConfig respects env var overrides", () => {
    const orig = {
      transport: process.env.TB_MCP_TRANSPORT,
      port: process.env.TB_MCP_PORT,
      host: process.env.TB_MCP_HOST,
    };

    process.env.TB_MCP_TRANSPORT = "http";
    process.env.TB_MCP_PORT = "9999";
    process.env.TB_MCP_HOST = "0.0.0.0";

    try {
      const cfg = loadMcpConfig();
      expect(cfg.transport).toBe("http");
      expect(cfg.port).toBe(9999);
      expect(cfg.host).toBe("0.0.0.0");
    } finally {
      if (orig.transport !== undefined)
        process.env.TB_MCP_TRANSPORT = orig.transport;
      else delete process.env.TB_MCP_TRANSPORT;
      if (orig.port !== undefined) process.env.TB_MCP_PORT = orig.port;
      else delete process.env.TB_MCP_PORT;
      if (orig.host !== undefined) process.env.TB_MCP_HOST = orig.host;
      else delete process.env.TB_MCP_HOST;
    }
  });

  test("loadTaskbookConfig reads env vars", () => {
    const orig = {
      url: process.env.TB_SERVER_URL,
      token: process.env.TB_TOKEN,
      key: process.env.TB_ENCRYPTION_KEY,
    };

    process.env.TB_SERVER_URL = "https://test.example.com";
    process.env.TB_TOKEN = "test-token-123";
    process.env.TB_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    try {
      const cfg = loadTaskbookConfig();
      expect(cfg.serverUrl).toBe("https://test.example.com");
      expect(cfg.token).toBe("test-token-123");
      expect(cfg.encryptionKey).toBe(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
    } finally {
      if (orig.url === undefined) delete process.env.TB_SERVER_URL;
      else process.env.TB_SERVER_URL = orig.url;
      if (orig.token === undefined) delete process.env.TB_TOKEN;
      else process.env.TB_TOKEN = orig.token;
      if (orig.key === undefined) delete process.env.TB_ENCRYPTION_KEY;
      else process.env.TB_ENCRYPTION_KEY = orig.key;
    }
  });
});
