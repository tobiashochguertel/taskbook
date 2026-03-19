import type { TaskbookConfig } from "../config.js";
import { decrypt, deriveKey, encrypt } from "./crypto.js";

// --- Domain types ---

export interface Task {
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

export interface Note {
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

export type StorageItem = Task | Note;

export interface EncryptedItem {
  data: string;
  nonce: string;
}

interface ItemsResponse {
  items: Record<string, EncryptedItem>;
}

interface HealthResponse {
  status: string;
  message?: string;
}

interface MeResponse {
  username: string;
  email: string;
}

// --- API Client ---

export class TaskbookClient {
  private baseUrl: string;
  private token: string;
  private cryptoKey: CryptoKey | null = null;
  private encryptionKeyRaw: string;

  constructor(config: TaskbookConfig) {
    this.baseUrl = config.serverUrl.replace(/\/+$/, "");
    this.token = config.token;
    this.encryptionKeyRaw = config.encryptionKey;
  }

  private async getKey(): Promise<CryptoKey> {
    if (!this.cryptoKey) {
      this.cryptoKey = await deriveKey(this.encryptionKeyRaw);
    }
    return this.cryptoKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Taskbook API ${method} ${path}: ${resp.status} ${text}`);
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await resp.json()) as T;
    }
    return {} as T;
  }

  // --- Decryption helpers ---

  private async decryptItems(
    encrypted: Record<string, EncryptedItem>,
  ): Promise<Record<string, StorageItem>> {
    const key = await this.getKey();
    const result: Record<string, StorageItem> = {};

    for (const [id, item] of Object.entries(encrypted)) {
      try {
        const json = await decrypt(item.data, item.nonce, key);
        result[id] = JSON.parse(json) as StorageItem;
      } catch {
        // Skip items that fail decryption (wrong key, corrupted data)
      }
    }
    return result;
  }

  private async encryptItem(
    item: StorageItem,
  ): Promise<EncryptedItem> {
    const key = await this.getKey();
    return encrypt(JSON.stringify(item), key);
  }

  // --- Public API ---

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/api/v1/health");
  }

  async me(): Promise<MeResponse> {
    return this.request<MeResponse>("GET", "/api/v1/me");
  }

  async getItems(): Promise<Record<string, StorageItem>> {
    const resp = await this.request<ItemsResponse>("GET", "/api/v1/items");
    return this.decryptItems(resp.items);
  }

  async getArchive(): Promise<Record<string, StorageItem>> {
    const resp = await this.request<ItemsResponse>(
      "GET",
      "/api/v1/items/archive",
    );
    return this.decryptItems(resp.items);
  }

  async putItems(items: Record<string, StorageItem>): Promise<void> {
    const encrypted: Record<string, EncryptedItem> = {};
    for (const [id, item] of Object.entries(items)) {
      encrypted[id] = await this.encryptItem(item);
    }
    await this.request("PUT", "/api/v1/items", { items: encrypted });
  }

  async putArchive(items: Record<string, StorageItem>): Promise<void> {
    const encrypted: Record<string, EncryptedItem> = {};
    for (const [id, item] of Object.entries(items)) {
      encrypted[id] = await this.encryptItem(item);
    }
    await this.request("PUT", "/api/v1/items/archive", { items: encrypted });
  }

  // --- High-level operations ---

  async listTasks(board?: string): Promise<Task[]> {
    const items = await this.getItems();
    const tasks = Object.values(items).filter(
      (i): i is Task => i._isTask,
    );
    if (board) {
      return tasks.filter((t) => t.boards.includes(board));
    }
    return tasks;
  }

  async listNotes(board?: string): Promise<Note[]> {
    const items = await this.getItems();
    const notes = Object.values(items).filter(
      (i): i is Note => !i._isTask,
    );
    if (board) {
      return notes.filter((n) => n.boards.includes(board));
    }
    return notes;
  }

  async listBoards(): Promise<string[]> {
    const items = await this.getItems();
    const boardSet = new Set<string>();
    for (const item of Object.values(items)) {
      for (const b of item.boards) boardSet.add(b);
    }
    return [...boardSet].sort();
  }

  async createTask(
    description: string,
    board: string = "My Board",
    priority: number = 1,
    tags: string[] = [],
  ): Promise<Task> {
    const items = await this.getItems();
    const maxId = Math.max(0, ...Object.values(items).map((i) => i._id));
    const now = new Date();
    const task: Task = {
      _id: maxId + 1,
      _date: now.toDateString().slice(0, 10),
      _timestamp: now.getTime(),
      _isTask: true,
      description,
      isStarred: false,
      isComplete: false,
      inProgress: false,
      priority: Math.min(3, Math.max(1, priority)),
      boards: [board.replace(/^@+/, "")],
      tags: tags.map((t) => t.replace(/^\++/, "").toLowerCase()),
    };
    items[String(task._id)] = task;
    await this.putItems(items);
    return task;
  }

  async createNote(
    description: string,
    board: string = "My Board",
    body?: string,
    tags: string[] = [],
  ): Promise<Note> {
    const items = await this.getItems();
    const maxId = Math.max(0, ...Object.values(items).map((i) => i._id));
    const now = new Date();
    const note: Note = {
      _id: maxId + 1,
      _date: now.toDateString().slice(0, 10),
      _timestamp: now.getTime(),
      _isTask: false,
      description,
      body,
      isStarred: false,
      boards: [board.replace(/^@+/, "")],
      tags: tags.map((t) => t.replace(/^\++/, "").toLowerCase()),
    };
    items[String(note._id)] = note;
    await this.putItems(items);
    return note;
  }

  async completeTask(taskId: number): Promise<Task> {
    const items = await this.getItems();
    const item = items[String(taskId)];
    if (!item || !item._isTask) {
      throw new Error(`Task ${taskId} not found`);
    }
    const task = item as Task;
    task.isComplete = !task.isComplete;
    task.inProgress = false;
    items[String(taskId)] = task;
    await this.putItems(items);
    return task;
  }

  async beginTask(taskId: number): Promise<Task> {
    const items = await this.getItems();
    const item = items[String(taskId)];
    if (!item || !item._isTask) {
      throw new Error(`Task ${taskId} not found`);
    }
    const task = item as Task;
    task.inProgress = !task.inProgress;
    items[String(taskId)] = task;
    await this.putItems(items);
    return task;
  }

  async starItem(itemId: number): Promise<StorageItem> {
    const items = await this.getItems();
    const item = items[String(itemId)];
    if (!item) throw new Error(`Item ${itemId} not found`);
    item.isStarred = !item.isStarred;
    items[String(itemId)] = item;
    await this.putItems(items);
    return item;
  }

  async deleteItem(itemId: number): Promise<void> {
    const items = await this.getItems();
    if (!items[String(itemId)]) {
      throw new Error(`Item ${itemId} not found`);
    }
    delete items[String(itemId)];
    await this.putItems(items);
  }

  async archiveItem(itemId: number): Promise<void> {
    const items = await this.getItems();
    const item = items[String(itemId)];
    if (!item) throw new Error(`Item ${itemId} not found`);

    delete items[String(itemId)];
    const archive = await this.getArchive();
    archive[String(itemId)] = item;

    await this.putItems(items);
    await this.putArchive(archive);
  }

  async moveToBoard(itemId: number, targetBoard: string): Promise<StorageItem> {
    const items = await this.getItems();
    const item = items[String(itemId)];
    if (!item) throw new Error(`Item ${itemId} not found`);
    item.boards = [targetBoard.replace(/^@+/, "")];
    items[String(itemId)] = item;
    await this.putItems(items);
    return item;
  }

  async editItem(
    itemId: number,
    description: string,
  ): Promise<StorageItem> {
    const items = await this.getItems();
    const item = items[String(itemId)];
    if (!item) throw new Error(`Item ${itemId} not found`);
    item.description = description;
    items[String(itemId)] = item;
    await this.putItems(items);
    return item;
  }

  async searchItems(query: string): Promise<StorageItem[]> {
    const items = await this.getItems();
    const lower = query.toLowerCase();
    return Object.values(items).filter(
      (item) =>
        item.description.toLowerCase().includes(lower) ||
        (item.tags ?? []).some((t) => t.includes(lower)) ||
        (item.boards ?? []).some((b) => b.toLowerCase().includes(lower)),
    );
  }
}
