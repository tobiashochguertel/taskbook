export interface TaskItem {
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

export interface NoteItem {
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

export type StorageItem = TaskItem | NoteItem;

export function isTask(item: StorageItem): item is TaskItem {
  return item._isTask === true;
}

export function isNote(item: StorageItem): item is NoteItem {
  return item._isTask === false;
}

/** Normalize legacy items: remap old field names and ensure required arrays exist */
export function normalizeItem<T extends StorageItem>(raw: Record<string, unknown>): T {
  const item = { ...raw } as Record<string, unknown>;
  if ("id" in item && !("_id" in item)) item._id = item.id;
  if ("date" in item && !("_date" in item)) item._date = item.date;
  if ("timestamp" in item && !("_timestamp" in item)) item._timestamp = item.timestamp;
  delete item.id;
  delete item.date;
  delete item.timestamp;
  if (!Array.isArray(item.boards)) item.boards = ["My Board"];
  if (!Array.isArray(item.tags)) item.tags = [];
  return item as T;
}

export const META_BOARDS_KEY = "_meta_boards";

export interface BoardsMetadata {
  _id: 0;
  _isTask: false;
  _date: string;
  _timestamp: number;
  _meta: "boards";
  boards: string[];
  description: string;
  isStarred: false;
  tags: string[];
}

export function isBoardsMetadata(item: unknown): item is BoardsMetadata {
  return (
    typeof item === "object" &&
    item !== null &&
    "_meta" in item &&
    (item as Record<string, unknown>)._meta === "boards"
  );
}

export type BoardItems = Record<string, StorageItem[]>;

export function groupByBoard(items: StorageItem[]): BoardItems {
  const boards: BoardItems = {};
  for (const item of items) {
    for (const board of item.boards) {
      if (!boards[board]) {
        boards[board] = [];
      }
      boards[board].push(item);
    }
  }
  return boards;
}

export function getBoards(items: StorageItem[]): string[] {
  const boardSet = new Set<string>();
  for (const item of items) {
    for (const board of item.boards) {
      boardSet.add(board);
    }
  }
  return Array.from(boardSet).sort();
}
