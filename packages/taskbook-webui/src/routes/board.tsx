import {
  CheckSquare,
  ChevronDown,
  LogOut,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommandPalette } from "../components/ui/command-palette";
import { TaskCard } from "../components/ui/task-card";
import { useEventSync, useItems, useUser } from "../hooks/useItems";
import { useAuth } from "../lib/auth";
import { getBoards, isTask, type StorageItem } from "../lib/types";

export function BoardPage() {
  const { logout } = useAuth();
  const { items, itemsList, isLoading, refetch, updateItems, isUpdating } =
    useItems();
  const user = useUser();
  useEventSync();

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const boards = useMemo(() => getBoards(itemsList), [itemsList]);
  const currentBoard = selectedBoard ?? boards[0] ?? "My Board";

  const boardItems = useMemo(() => {
    return itemsList.filter((item) => item.boards.includes(currentBoard));
  }, [itemsList, currentBoard]);

  const tasks = useMemo(
    () => boardItems.filter((i) => isTask(i) && !i.isComplete),
    [boardItems],
  );
  const notes = useMemo(
    () => boardItems.filter((i) => !isTask(i)),
    [boardItems],
  );
  const done = useMemo(
    () => boardItems.filter((i) => isTask(i) && i.isComplete),
    [boardItems],
  );

  const toggleComplete = useCallback(
    (item: StorageItem) => {
      if (!isTask(item)) return;
      const updated = { ...items };
      updated[String(item.id)] = { ...item, isComplete: !item.isComplete };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const toggleStar = useCallback(
    (item: StorageItem) => {
      const updated = { ...items };
      updated[String(item.id)] = { ...item, isStarred: !item.isStarred };
      updateItems(updated);
    },
    [items, updateItems],
  );

  // Keyboard shortcut for command palette
  if (typeof window !== "undefined") {
    import("tinykeys").then(({ tinykeys }) => {
      tinykeys(window, {
        "$mod+KeyK": (e) => {
          e.preventDefault();
          setShowCommandPalette(true);
        },
      });
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="animate-pulse"
          style={{ color: "var(--color-text-muted)" }}
        >
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-bold"
            style={{ color: "var(--color-accent)" }}
          >
            ⚡ Taskbook
          </h1>

          {/* Board selector */}
          <div className="relative">
            <select
              value={currentBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="appearance-none pr-8 pl-3 py-1.5 rounded text-sm cursor-pointer border-none"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            >
              {boards.map((board) => (
                <option key={board} value={board}>
                  @{board}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {user.data?.username}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded hover:opacity-80 cursor-pointer border-none"
            style={{ color: "var(--color-text-muted)", background: "none" }}
            title="Refresh"
          >
            <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded hover:opacity-80 cursor-pointer border-none"
            style={{ color: "var(--color-text-muted)", background: "none" }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Board columns */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Tasks column */}
        <Column
          title="Tasks"
          icon={<CheckSquare size={16} />}
          items={tasks}
          onToggleComplete={toggleComplete}
          onToggleStar={toggleStar}
          accentColor="var(--color-warning)"
        />

        {/* Notes column */}
        <Column
          title="Notes"
          icon={<StickyNote size={16} />}
          items={notes}
          onToggleComplete={toggleComplete}
          onToggleStar={toggleStar}
          accentColor="var(--color-info)"
        />

        {/* Done column */}
        <Column
          title="Done"
          icon={<CheckSquare size={16} />}
          items={done}
          onToggleComplete={toggleComplete}
          onToggleStar={toggleStar}
          accentColor="var(--color-success)"
        />
      </main>

      {/* Keyboard hint */}
      <footer
        className="px-6 py-2 text-center text-xs border-t"
        style={{
          color: "var(--color-text-muted)",
          borderColor: "var(--color-border)",
        }}
      >
        Press{" "}
        <kbd
          className="px-1.5 py-0.5 rounded text-xs"
          style={{
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text)",
          }}
        >
          ⌘K
        </kbd>{" "}
        for command palette
      </footer>

      {showCommandPalette && (
        <CommandPalette
          items={itemsList}
          boards={boards}
          onClose={() => setShowCommandPalette(false)}
          onSelectBoard={setSelectedBoard}
        />
      )}
    </div>
  );
}

function Column({
  title,
  icon,
  items,
  onToggleComplete,
  onToggleStar,
  accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  items: StorageItem[];
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
  accentColor: string;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-2 mb-3 pb-2 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: accentColor }}>
          {title}
        </h2>
        <span
          className="text-xs ml-auto px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text-muted)",
          }}
        >
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p
            className="text-xs py-4 text-center"
            style={{ color: "var(--color-text-muted)" }}
          >
            No items
          </p>
        ) : (
          items.map((item) => (
            <TaskCard
              key={item.id}
              item={item}
              onToggleComplete={() => onToggleComplete(item)}
              onToggleStar={() => onToggleStar(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}
