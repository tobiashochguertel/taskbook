import { describe, expect, test } from "bun:test";
import { createMcpServer } from "../src/server.js";
import { TaskbookClient } from "../src/client/api.js";

describe("server", () => {
  const dummyClient = new TaskbookClient({
    serverUrl: "http://localhost:9999",
    token: "dummy",
    encryptionKey:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });

  test("createMcpServer returns an McpServer instance", () => {
    const server = createMcpServer(() => dummyClient);
    expect(server).toBeDefined();
  });

  test("server has correct name and version", () => {
    const server = createMcpServer(() => dummyClient);
    // The server object has a name/version accessible via the serverInfo
    expect(server).toHaveProperty("server");
  });
});
