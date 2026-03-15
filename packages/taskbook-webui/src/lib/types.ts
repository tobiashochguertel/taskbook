export interface TaskItem {
  id: number;
  date: string;
  timestamp: number;
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
  id: number;
  date: string;
  timestamp: number;
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
