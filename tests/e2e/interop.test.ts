/**
 * CLI ↔ WebUI Interop E2E Tests
 *
 * Verifies that items created/modified by one client (CLI or WebUI) are
 * correctly visible and modifiable by the other, using the shared server API
 * with AES-256-GCM client-side encryption (matching both Rust CLI and WebUI).
 *
 * Usage:
 *   TB_TEST_SERVER_URL=https://taskbook.hochguertel.work bun test tests/e2e/interop.test.ts
 *
 * Environment variables:
 *   TB_TEST_SERVER_URL  - Server URL (default: https://taskbook.hochguertel.work)
 *   TB_TEST_USERNAME    - Existing user (optional; a fresh user is registered if omitted)
 *   TB_TEST_PASSWORD    - Password for existing user
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// ── Configuration ──────────────────────────────────────────────────────────

const SERVER =
  process.env.TB_TEST_SERVER_URL ?? "https://taskbook.hochguertel.work";

const TS = Date.now();
const RAND = Math.random().toString(36).slice(2, 10);

// ── Crypto helpers (AES-256-GCM, compatible with Rust CLI + WebUI) ─────────

function base64Encode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptItem(
  plaintext: string,
  key: CryptoKey,
): Promise<{ data: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return {
    data: base64Encode(new Uint8Array(ciphertext)),
    nonce: base64Encode(iv),
  };
}

async function decryptItem(
  data: string,
  nonce: string,
  key: CryptoKey,
): Promise<string> {
  const ciphertext = base64Decode(data);
  const iv = base64Decode(nonce);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// ── Item factories (matching Rust StorageItem JSON schema) ──────────────────

interface TaskItem {
  _id: number;
  _date: string;
  _timestamp: number;
  _isTask: true;
  description: string;
  isStarred: boolean;
  isComplete: boolean;
  inProgress: boolean;
  priority: number;
  boards: string[];
  tags: string[];
}

interface NoteItem {
  _id: number;
  _date: string;
  _timestamp: number;
  _isTask: false;
  description: string;
  body?: string;
  isStarred: boolean;
  boards: string[];
  tags: string[];
}

type StorageItem = TaskItem | NoteItem;

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  const now = new Date();
  return {
    _id: overrides._id ?? Math.floor(Math.random() * 100000),
    _date: now.toDateString(),
    _timestamp: now.getTime(),
    _isTask: true,
    description: overrides.description ?? `Test task ${RAND}`,
    isStarred: overrides.isStarred ?? false,
    isComplete: overrides.isComplete ?? false,
    inProgress: overrides.inProgress ?? false,
    priority: overrides.priority ?? 1,
    boards: overrides.boards ?? ["My Board"],
    tags: overrides.tags ?? [],
  };
}

function makeNote(overrides: Partial<NoteItem> = {}): NoteItem {
  const now = new Date();
  return {
    _id: overrides._id ?? Math.floor(Math.random() * 100000),
    _date: now.toDateString(),
    _timestamp: now.getTime(),
    _isTask: false,
    description: overrides.description ?? `Test note ${RAND}`,
    isStarred: overrides.isStarred ?? false,
    boards: overrides.boards ?? ["My Board"],
    tags: overrides.tags ?? [],
    ...(overrides.body !== undefined ? { body: overrides.body } : {}),
  };
}

// ── API client ──────────────────────────────────────────────────────────────

interface EncryptedItemData {
  data: string;
  nonce: string;
}
type ItemsMap = Record<string, EncryptedItemData>;

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${SERVER}${path}`, { ...options, headers });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status, body };
}

async function register(
  username: string,
  email: string,
  password: string,
): Promise<string> {
  const { status, body } = await apiRequest<{ token: string }>(
    "/api/v1/register",
    { method: "POST", body: JSON.stringify({ username, email, password }) },
  );
  if (status !== 200 || !body.token) {
    throw new Error(`Registration failed (${status}): ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function login(username: string, password: string): Promise<string> {
  const { status, body } = await apiRequest<{ token: string }>(
    "/api/v1/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
  );
  if (status !== 200 || !body.token) {
    throw new Error(`Login failed (${status}): ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function getItems(token: string): Promise<ItemsMap> {
  const { status, body } = await apiRequest<{ items: ItemsMap }>(
    "/api/v1/items",
    {},
    token,
  );
  if (status !== 200)
    throw new Error(`GET items failed (${status}): ${JSON.stringify(body)}`);
  return body.items ?? {};
}

async function putItems(token: string, items: ItemsMap): Promise<void> {
  const { status, body } = await apiRequest<unknown>(
    "/api/v1/items",
    { method: "PUT", body: JSON.stringify({ items }) },
    token,
  );
  if (status !== 200)
    throw new Error(`PUT items failed (${status}): ${JSON.stringify(body)}`);
}

async function getArchive(token: string): Promise<ItemsMap> {
  const { status, body } = await apiRequest<{ items: ItemsMap }>(
    "/api/v1/items/archive",
    {},
    token,
  );
  if (status !== 200)
    throw new Error(`GET archive failed (${status}): ${JSON.stringify(body)}`);
  return body.items ?? {};
}

async function putArchive(token: string, items: ItemsMap): Promise<void> {
  const { status, body } = await apiRequest<unknown>(
    "/api/v1/items/archive",
    { method: "PUT", body: JSON.stringify({ items }) },
    token,
  );
  if (status !== 200)
    throw new Error(
      `PUT archive failed (${status}): ${JSON.stringify(body)}`,
    );
}

// ── Helpers to encrypt/decrypt full items maps ──────────────────────────────

async function encryptItemsMap(
  items: Record<string, StorageItem>,
  key: CryptoKey,
): Promise<ItemsMap> {
  const encrypted: ItemsMap = {};
  for (const [k, v] of Object.entries(items)) {
    encrypted[k] = await encryptItem(JSON.stringify(v), key);
  }
  return encrypted;
}

async function decryptItemsMap(
  encrypted: ItemsMap,
  key: CryptoKey,
): Promise<Record<string, StorageItem>> {
  const items: Record<string, StorageItem> = {};
  for (const [k, v] of Object.entries(encrypted)) {
    const json = await decryptItem(v.data, v.nonce, key);
    items[k] = JSON.parse(json) as StorageItem;
  }
  return items;
}

// ── Shared test state ───────────────────────────────────────────────────────

let cliToken: string;
let webToken: string;
let cryptoKey: CryptoKey;
const rawKey = crypto.getRandomValues(new Uint8Array(32));

const TEST_USER = `interop_${TS}_${RAND}`;
const TEST_EMAIL = `${TEST_USER}@example.com`;
const TEST_PASS = `SecureInterop_${RAND}!`;

// ── Setup & teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  // Verify server is reachable
  const health = await apiRequest<{ status: string }>("/api/v1/health");
  if (health.status !== 200 || health.body.status !== "ok") {
    throw new Error(`Server not healthy: ${JSON.stringify(health)}`);
  }

  cryptoKey = await importKey(rawKey);

  if (process.env.TB_TEST_USERNAME && process.env.TB_TEST_PASSWORD) {
    // Use provided credentials
    cliToken = await login(
      process.env.TB_TEST_USERNAME,
      process.env.TB_TEST_PASSWORD,
    );
    webToken = await login(
      process.env.TB_TEST_USERNAME,
      process.env.TB_TEST_PASSWORD,
    );
  } else {
    // Register a fresh user, then get two sessions (simulating CLI + WebUI)
    cliToken = await register(TEST_USER, TEST_EMAIL, TEST_PASS);
    webToken = await login(TEST_USER, TEST_PASS);
  }

  // Start clean
  await putItems(cliToken, {});
  await putArchive(cliToken, {});
});

afterAll(async () => {
  // Clean up: remove all items and archive
  try {
    await putItems(cliToken, {});
    await putArchive(cliToken, {});
  } catch {
    // best-effort cleanup
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Items created via CLI appear in WebUI
// ═══════════════════════════════════════════════════════════════════════════

describe("1. CLI → WebUI: items created via CLI visible in WebUI", () => {
  test("task created by CLI is readable by WebUI", async () => {
    const task = makeTask({ _id: 1, description: "CLI task for WebUI" });
    const encrypted = await encryptItemsMap({ "1": task }, cryptoKey);

    await putItems(cliToken, encrypted);

    const webItems = await getItems(webToken);
    expect(webItems).toHaveProperty("1");

    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(decrypted["1"]).toBeDefined();
    expect((decrypted["1"] as TaskItem)._isTask).toBe(true);
    expect(decrypted["1"].description).toBe("CLI task for WebUI");
  });

  test("note created by CLI is readable by WebUI", async () => {
    const task = makeTask({ _id: 1, description: "CLI task for WebUI" });
    const note = makeNote({
      _id: 2,
      description: "CLI note for WebUI",
      body: "Rich body content",
    });
    const encrypted = await encryptItemsMap(
      { "1": task, "2": note },
      cryptoKey,
    );

    await putItems(cliToken, encrypted);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);

    expect(decrypted["2"]).toBeDefined();
    expect((decrypted["2"] as NoteItem)._isTask).toBe(false);
    expect(decrypted["2"].description).toBe("CLI note for WebUI");
    expect((decrypted["2"] as NoteItem).body).toBe("Rich body content");
  });

  test("multiple items created by CLI all visible in WebUI", async () => {
    const items: Record<string, StorageItem> = {};
    for (let i = 1; i <= 5; i++) {
      items[String(i)] = makeTask({
        _id: i,
        description: `Batch task ${i}`,
      });
    }
    const encrypted = await encryptItemsMap(items, cryptoKey);
    await putItems(cliToken, encrypted);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(Object.keys(decrypted)).toHaveLength(5);
    for (let i = 1; i <= 5; i++) {
      expect(decrypted[String(i)].description).toBe(`Batch task ${i}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Items created via WebUI appear in CLI
// ═══════════════════════════════════════════════════════════════════════════

describe("2. WebUI → CLI: items created via WebUI visible in CLI", () => {
  test("task created by WebUI is readable by CLI", async () => {
    const task = makeTask({ _id: 10, description: "WebUI task for CLI" });
    const encrypted = await encryptItemsMap({ "10": task }, cryptoKey);

    await putItems(webToken, encrypted);

    const cliItems = await getItems(cliToken);
    expect(cliItems).toHaveProperty("10");

    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect(decrypted["10"].description).toBe("WebUI task for CLI");
    expect((decrypted["10"] as TaskItem)._isTask).toBe(true);
  });

  test("note with body created by WebUI is readable by CLI", async () => {
    const note = makeNote({
      _id: 11,
      description: "WebUI note",
      body: "Body from WebUI",
    });
    const encrypted = await encryptItemsMap({ "11": note }, cryptoKey);

    await putItems(webToken, encrypted);

    const cliItems = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect((decrypted["11"] as NoteItem)._isTask).toBe(false);
    expect((decrypted["11"] as NoteItem).body).toBe("Body from WebUI");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. State changes propagate between clients
// ═══════════════════════════════════════════════════════════════════════════

describe("3. State changes propagate between CLI and WebUI", () => {
  test("completing a task via CLI is visible in WebUI", async () => {
    const task = makeTask({
      _id: 20,
      description: "Complete me",
      isComplete: false,
    });
    const encrypted = await encryptItemsMap({ "20": task }, cryptoKey);
    await putItems(cliToken, encrypted);

    // CLI marks task complete
    task.isComplete = true;
    const updated = await encryptItemsMap({ "20": task }, cryptoKey);
    await putItems(cliToken, updated);

    // WebUI reads
    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect((decrypted["20"] as TaskItem).isComplete).toBe(true);
  });

  test("starring an item via WebUI is visible in CLI", async () => {
    const task = makeTask({
      _id: 21,
      description: "Star me",
      isStarred: false,
    });
    const encrypted = await encryptItemsMap({ "21": task }, cryptoKey);
    await putItems(webToken, encrypted);

    // WebUI stars the task
    task.isStarred = true;
    const updated = await encryptItemsMap({ "21": task }, cryptoKey);
    await putItems(webToken, updated);

    // CLI reads
    const cliItems = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect((decrypted["21"] as TaskItem).isStarred).toBe(true);
  });

  test("changing priority via CLI is visible in WebUI", async () => {
    const task = makeTask({
      _id: 22,
      description: "Prioritize me",
      priority: 1,
    });
    const encrypted = await encryptItemsMap({ "22": task }, cryptoKey);
    await putItems(cliToken, encrypted);

    // CLI bumps priority
    task.priority = 3;
    const updated = await encryptItemsMap({ "22": task }, cryptoKey);
    await putItems(cliToken, updated);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect((decrypted["22"] as TaskItem).priority).toBe(3);
  });

  test("toggling inProgress via WebUI is visible in CLI", async () => {
    const task = makeTask({
      _id: 23,
      description: "Progress me",
      inProgress: false,
    });
    const encrypted = await encryptItemsMap({ "23": task }, cryptoKey);
    await putItems(webToken, encrypted);

    // WebUI starts progress
    task.inProgress = true;
    const updated = await encryptItemsMap({ "23": task }, cryptoKey);
    await putItems(webToken, updated);

    const cliItems = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect((decrypted["23"] as TaskItem).inProgress).toBe(true);
  });

  test("editing description via CLI is visible in WebUI", async () => {
    const task = makeTask({
      _id: 24,
      description: "Original description",
    });
    const encrypted = await encryptItemsMap({ "24": task }, cryptoKey);
    await putItems(cliToken, encrypted);

    task.description = "Updated by CLI";
    const updated = await encryptItemsMap({ "24": task }, cryptoKey);
    await putItems(cliToken, updated);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(decrypted["24"].description).toBe("Updated by CLI");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Board creation/deletion syncs between clients
// ═══════════════════════════════════════════════════════════════════════════

describe("4. Board operations sync between CLI and WebUI", () => {
  test("items on a new board created via CLI are visible in WebUI", async () => {
    const task = makeTask({
      _id: 30,
      description: "Board task",
      boards: ["Project Alpha"],
    });
    const encrypted = await encryptItemsMap({ "30": task }, cryptoKey);
    await putItems(cliToken, encrypted);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(decrypted["30"].boards).toContain("Project Alpha");
  });

  test("moving item to different board via WebUI is visible in CLI", async () => {
    const task = makeTask({
      _id: 31,
      description: "Move me",
      boards: ["Board A"],
    });
    const encrypted = await encryptItemsMap({ "31": task }, cryptoKey);
    await putItems(webToken, encrypted);

    // WebUI moves task to Board B
    task.boards = ["Board B"];
    const updated = await encryptItemsMap({ "31": task }, cryptoKey);
    await putItems(webToken, updated);

    const cliItems = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect(decrypted["31"].boards).toContain("Board B");
    expect(decrypted["31"].boards).not.toContain("Board A");
  });

  test("item with multiple boards syncs correctly", async () => {
    const task = makeTask({
      _id: 32,
      description: "Multi-board",
      boards: ["Board X", "Board Y"],
    });
    const encrypted = await encryptItemsMap({ "32": task }, cryptoKey);
    await putItems(cliToken, encrypted);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(decrypted["32"].boards).toEqual(
      expect.arrayContaining(["Board X", "Board Y"]),
    );
    expect(decrypted["32"].boards).toHaveLength(2);
  });

  test("deleting board (removing all items from it) syncs via CLI to WebUI", async () => {
    // Create items on two boards
    const t1 = makeTask({
      _id: 40,
      description: "Keep me",
      boards: ["Persist"],
    });
    const t2 = makeTask({
      _id: 41,
      description: "Remove my board",
      boards: ["Ephemeral"],
    });
    const encrypted = await encryptItemsMap(
      { "40": t1, "41": t2 },
      cryptoKey,
    );
    await putItems(cliToken, encrypted);

    // CLI deletes the Ephemeral board by removing its item
    const remaining = await encryptItemsMap({ "40": t1 }, cryptoKey);
    await putItems(cliToken, remaining);

    const webItems = await getItems(webToken);
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(Object.keys(decrypted)).toHaveLength(1);
    expect(decrypted["40"].boards).toContain("Persist");
    expect(decrypted["41"]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Archive operations sync correctly
// ═══════════════════════════════════════════════════════════════════════════

describe("5. Archive operations sync between CLI and WebUI", () => {
  test("archiving items via CLI makes them visible in WebUI archive", async () => {
    // Start with items in active list
    const task = makeTask({
      _id: 50,
      description: "Archive me",
      isComplete: true,
    });
    const activeItems = await encryptItemsMap({ "50": task }, cryptoKey);
    await putItems(cliToken, activeItems);

    // CLI moves completed task to archive
    await putItems(cliToken, {}); // remove from active
    const archiveItems = await encryptItemsMap({ "50": task }, cryptoKey);
    await putArchive(cliToken, archiveItems);

    // WebUI checks: active should be empty, archive should have the task
    const webActive = await getItems(webToken);
    expect(Object.keys(webActive)).toHaveLength(0);

    const webArchive = await getArchive(webToken);
    const decrypted = await decryptItemsMap(webArchive, cryptoKey);
    expect(decrypted["50"]).toBeDefined();
    expect(decrypted["50"].description).toBe("Archive me");
  });

  test("restoring items from archive via WebUI makes them visible in CLI", async () => {
    // Set up archive with a task
    const task = makeTask({ _id: 51, description: "Restore me" });
    const archiveItems = await encryptItemsMap({ "51": task }, cryptoKey);
    await putArchive(webToken, archiveItems);
    await putItems(webToken, {});

    // WebUI restores from archive to active
    await putArchive(webToken, {}); // clear archive
    const activeItems = await encryptItemsMap({ "51": task }, cryptoKey);
    await putItems(webToken, activeItems);

    // CLI checks
    const cliActive = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliActive, cryptoKey);
    expect(decrypted["51"]).toBeDefined();
    expect(decrypted["51"].description).toBe("Restore me");

    const cliArchive = await getArchive(cliToken);
    expect(Object.keys(cliArchive)).toHaveLength(0);
  });

  test("archive and active lists are independent", async () => {
    const activeTask = makeTask({ _id: 60, description: "Active task" });
    const archivedTask = makeTask({
      _id: 61,
      description: "Archived task",
      isComplete: true,
    });

    await putItems(cliToken, await encryptItemsMap({ "60": activeTask }, cryptoKey));
    await putArchive(
      cliToken,
      await encryptItemsMap({ "61": archivedTask }, cryptoKey),
    );

    // WebUI should see them in separate lists
    const webActive = await getItems(webToken);
    const webArchive = await getArchive(webToken);

    const decActive = await decryptItemsMap(webActive, cryptoKey);
    const decArchive = await decryptItemsMap(webArchive, cryptoKey);

    expect(Object.keys(decActive)).toHaveLength(1);
    expect(decActive["60"].description).toBe("Active task");

    expect(Object.keys(decArchive)).toHaveLength(1);
    expect(decArchive["61"].description).toBe("Archived task");
  });

  test("clearing archive via CLI is reflected in WebUI", async () => {
    // Populate archive
    const task = makeTask({ _id: 70, description: "Will be cleared" });
    await putArchive(
      cliToken,
      await encryptItemsMap({ "70": task }, cryptoKey),
    );

    // Verify it exists
    let webArchive = await getArchive(webToken);
    expect(Object.keys(webArchive).length).toBeGreaterThan(0);

    // CLI clears archive
    await putArchive(cliToken, {});

    // WebUI sees empty archive
    webArchive = await getArchive(webToken);
    expect(Object.keys(webArchive)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Cross-client encryption compatibility
// ═══════════════════════════════════════════════════════════════════════════

describe("6. Cross-client encryption round-trip", () => {
  test("data encrypted by one session is decryptable by another", async () => {
    const task = makeTask({ _id: 80, description: "Encryption round-trip" });
    const encrypted = await encryptItemsMap({ "80": task }, cryptoKey);

    // PUT via CLI session
    await putItems(cliToken, encrypted);

    // GET via WebUI session — server returns same encrypted blobs
    const webItems = await getItems(webToken);

    // Decrypt with same key — should yield identical item
    const decrypted = await decryptItemsMap(webItems, cryptoKey);
    expect(decrypted["80"].description).toBe("Encryption round-trip");
    expect((decrypted["80"] as TaskItem)._isTask).toBe(true);
  });

  test("re-encrypting and re-uploading with new nonces works", async () => {
    // First upload
    const task = makeTask({ _id: 81, description: "Re-encrypt test" });
    const enc1 = await encryptItemsMap({ "81": task }, cryptoKey);
    await putItems(cliToken, enc1);
    const nonce1 = enc1["81"].nonce;

    // Re-encrypt with (implicitly) new random nonce and re-upload
    const enc2 = await encryptItemsMap({ "81": task }, cryptoKey);
    await putItems(webToken, enc2);
    const nonce2 = enc2["81"].nonce;

    // Nonces should differ (random)
    expect(nonce1).not.toBe(nonce2);

    // Both sessions can still read
    const cliItems = await getItems(cliToken);
    const decrypted = await decryptItemsMap(cliItems, cryptoKey);
    expect(decrypted["81"].description).toBe("Re-encrypt test");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Data isolation — different user cannot see items
// ═══════════════════════════════════════════════════════════════════════════

describe("7. Data isolation between users", () => {
  test("items from test user are not visible to another user", async () => {
    // Put an item as our test user
    const task = makeTask({ _id: 90, description: "Private item" });
    await putItems(
      cliToken,
      await encryptItemsMap({ "90": task }, cryptoKey),
    );

    // Register a second user
    const otherUser = `other_${TS}_${RAND}`;
    const otherToken = await register(
      otherUser,
      `${otherUser}@example.com`,
      `OtherPass_${RAND}!`,
    );

    // Second user should see empty items
    const otherItems = await getItems(otherToken);
    expect(Object.keys(otherItems)).toHaveLength(0);
  });
});
