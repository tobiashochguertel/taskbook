import { CheckSquare, StickyNote } from "lucide-react";
import { useMemo } from "react";
import { TaskCard } from "./task-card";
import {
  groupByBoard,
  isBoardsMetadata,
  isTask,
  type StorageItem,
} from "../../lib/types";

interface ItemCallbacks {
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
  onDelete: (item: StorageItem) => void;
  onEdit: (item: StorageItem, desc: string) => void;
  onToggleProgress: (item: StorageItem) => void;
  onChangePriority: (item: StorageItem, p: number) => void;
  onMoveToBoard: (item: StorageItem, board: string) => void;
  onUpdateTags: (item: StorageItem, tags: string[]) => void;
  onArchive: (item: StorageItem) => void;
  boards: string[];
}

interface AllBoardsViewProps extends ItemCallbacks {
  items: StorageItem[];
}

interface BoardStats {
  tasks: number;
  notes: number;
  done: number;
  total: number;
}

function computeStats(boardItems: StorageItem[]): BoardStats {
  let tasks = 0;
  let notes = 0;
  let done = 0;
  for (const item of boardItems) {
    if (isTask(item)) {
      if (item.isComplete) done++;
      else tasks++;
    } else {
      notes++;
    }
  }
  return { tasks, notes, done, total: boardItems.length };
}

/**
 * AllBoardsView shows all boards stacked vertically, like the TUI does.
 * Each board has a header with name and completion stats, followed by its items.
 */
export function AllBoardsView({
  items,
  ...callbacks
}: AllBoardsViewProps) {
  const { boards } = callbacks;
  const realItems = useMemo(
    () => items.filter((i) => !isBoardsMetadata(i)),
    [items],
  );

  const grouped = useMemo(() => groupByBoard(realItems), [realItems]);

  const orderedBoards = useMemo(() => {
    const fromItems = Object.keys(grouped);
    const all = new Set([...fromItems, ...boards]);
    return Array.from(all).sort();
  }, [grouped, boards]);

  const globalStats = useMemo(() => {
    let tasks = 0;
    let notes = 0;
    let done = 0;
    for (const item of realItems) {
      if (isTask(item)) {
        if (item.isComplete) done++;
        else tasks++;
      } else {
        notes++;
      }
    }
    return { tasks, notes, done, boardCount: orderedBoards.length };
  }, [realItems, orderedBoards]);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 md:px-6 py-4 md:py-6">
      {/* Summary stats bar */}
      <div
        className="flex flex-wrap items-center gap-3 md:gap-4 mb-6 px-3 py-2 rounded-lg text-xs md:text-sm"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text-muted)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span className="flex items-center gap-1">
          <CheckSquare size={14} style={{ color: "var(--color-warning)" }} />
          {globalStats.tasks} {globalStats.tasks === 1 ? "task" : "tasks"}
        </span>
        <span className="flex items-center gap-1">
          <StickyNote size={14} style={{ color: "var(--color-info)" }} />
          {globalStats.notes} {globalStats.notes === 1 ? "note" : "notes"}
        </span>
        <span className="flex items-center gap-1">
          <CheckSquare size={14} style={{ color: "var(--color-success)" }} />
          {globalStats.done} done
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>
          across {globalStats.boardCount}{" "}
          {globalStats.boardCount === 1 ? "board" : "boards"}
        </span>
      </div>

      {/* Boards stacked vertically */}
      <div className="space-y-6 md:space-y-8">
        {orderedBoards.map((boardName) => {
          const boardItems = grouped[boardName] ?? [];
          const stats = computeStats(boardItems);

          const incompleteTasks = boardItems.filter(
            (i) => isTask(i) && !i.isComplete,
          );
          const notes = boardItems.filter((i) => !isTask(i));
          const doneTasks = boardItems.filter(
            (i) => isTask(i) && i.isComplete,
          );

          return (
            <section key={boardName}>
              {/* Board header */}
              <div
                className="flex items-center gap-2 mb-3 pb-2 border-b"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h2
                  className="text-sm md:text-base font-semibold"
                  style={{ color: "var(--color-accent)" }}
                >
                  @{boardName}
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {stats.done}/{stats.tasks + stats.done}
                </span>
              </div>

              {/* Board items */}
              {boardItems.length === 0 ? (
                <p
                  className="text-xs md:text-sm py-4 text-center"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  No items
                </p>
              ) : (
                <div className="space-y-2">
                  {[...incompleteTasks, ...notes, ...doneTasks].map((item) => (
                    <TaskCard
                      key={item._id}
                      item={item}
                      onToggleComplete={() => callbacks.onToggleComplete(item)}
                      onToggleStar={() => callbacks.onToggleStar(item)}
                      onDelete={() => callbacks.onDelete(item)}
                      onEdit={(desc) => callbacks.onEdit(item, desc)}
                      onToggleProgress={() => callbacks.onToggleProgress(item)}
                      onChangePriority={(p) =>
                        callbacks.onChangePriority(item, p)
                      }
                      onMoveToBoard={(b) => callbacks.onMoveToBoard(item, b)}
                      onUpdateTags={(tags) =>
                        callbacks.onUpdateTags(item, tags)
                      }
                      onArchive={() => callbacks.onArchive(item)}
                      boards={callbacks.boards}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
