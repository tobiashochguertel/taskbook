import { useCallback, useMemo } from "react";
import {
  type BoardsMetadata,
  getBoards,
  isBoardsMetadata,
  META_BOARDS_KEY,
  type StorageItem,
} from "../lib/types";

function createBoardsMetadata(boards: string[]): BoardsMetadata {
  return {
    _id: 0,
    _isTask: false,
    _date: "",
    _timestamp: 0,
    _meta: "boards",
    boards,
    description: "",
    isStarred: false,
    tags: [],
  };
}

/**
 * Manages the board list by combining boards derived from items with
 * custom (possibly empty) boards stored as a `_meta_boards` metadata item.
 * This replaces the localStorage approach so boards sync across clients.
 */
export function useBoards(
  items: Record<string, StorageItem>,
  updateItems: (updated: Record<string, StorageItem>) => void,
) {
  const metaItem = items[META_BOARDS_KEY];
  const customBoards: string[] = useMemo(() => {
    if (metaItem && isBoardsMetadata(metaItem)) {
      return metaItem.boards;
    }
    return [];
  }, [metaItem]);

  const itemsList = useMemo(() => Object.values(items), [items]);

  const itemBoards = useMemo(() => {
    // Boards derived from actual items (excluding the meta item itself)
    return getBoards(itemsList.filter((i) => !isBoardsMetadata(i)));
  }, [itemsList]);

  const boards = useMemo(() => {
    const all = new Set([...itemBoards, ...customBoards]);
    return Array.from(all).sort();
  }, [itemBoards, customBoards]);

  const setCustomBoards = useCallback(
    (next: string[]) => {
      const updated = { ...items };
      updated[META_BOARDS_KEY] = createBoardsMetadata(
        next,
      ) as unknown as StorageItem;
      updateItems(updated);
    },
    [items, updateItems],
  );

  const addCustomBoard = useCallback(
    (name: string) => {
      const cleaned = name.replace(/^@+/, "").trim();
      if (!cleaned || customBoards.includes(cleaned)) return;
      setCustomBoards([...customBoards, cleaned]);
    },
    [customBoards, setCustomBoards],
  );

  const deleteCustomBoard = useCallback(
    (name: string) => {
      setCustomBoards(customBoards.filter((b) => b !== name));
    },
    [customBoards, setCustomBoards],
  );

  const renameCustomBoard = useCallback(
    (oldName: string, newName: string) => {
      const cleaned = newName.replace(/^@+/, "").trim();
      if (!cleaned || cleaned === oldName) return;
      const next = customBoards.map((b) => (b === oldName ? cleaned : b));
      if (!next.includes(cleaned)) next.push(cleaned);
      setCustomBoards([...new Set(next)]);
    },
    [customBoards, setCustomBoards],
  );

  return {
    boards,
    customBoards,
    itemBoards,
    addCustomBoard,
    deleteCustomBoard,
    renameCustomBoard,
  };
}
