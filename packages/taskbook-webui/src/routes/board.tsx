import {
  CheckSquare,
  ChevronDown,
  LogOut,
  RefreshCw,
  Search,
  StickyNote,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommandPalette } from "../components/ui/command-palette";
import { CreateItemSheet } from "../components/ui/create-item-sheet";
import { Drawer } from "../components/ui/drawer";
import { Fab } from "../components/ui/fab";
import { MobileTabs, type MobileTab } from "../components/ui/mobile-tabs";
import { SettingsDialog } from "../components/ui/settings-dialog";
import { TaskCard } from "../components/ui/task-card";
import { useEventSync, useItems, useUser } from "../hooks/useItems";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { getBoards, isTask, type StorageItem, type TaskItem, type NoteItem } from "../lib/types";

export function BoardPage() {
  const { logout } = useAuth();
  const { items, itemsList, isLoading, refetch, updateItems, isUpdating } =
    useItems();
  const user = useUser();
  useEventSync();

  const { settings, isMobile } = useSettings();

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("tasks");

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

  const createTask = useCallback(
    (description: string, board: string, priority: number) => {
      const maxId = itemsList.reduce((max, i) => Math.max(max, i.id), 0);
      const newTask: TaskItem = {
        id: maxId + 1,
        date: new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        timestamp: Date.now(),
        _isTask: true,
        description,
        isStarred: false,
        isComplete: false,
        inProgress: false,
        priority,
        boards: [board],
        tags: [],
      };
      const updated = { ...items, [String(newTask.id)]: newTask };
      updateItems(updated);
    },
    [items, itemsList, updateItems],
  );

  const createNote = useCallback(
    (description: string, board: string) => {
      const maxId = itemsList.reduce((max, i) => Math.max(max, i.id), 0);
      const newNote: NoteItem = {
        id: maxId + 1,
        date: new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        timestamp: Date.now(),
        _isTask: false,
        description,
        isStarred: false,
        boards: [board],
        tags: [],
      };
      const updated = { ...items, [String(newNote.id)]: newNote };
      updateItems(updated);
    },
    [items, itemsList, updateItems],
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

  const showBurger =
    settings.navStyle === "burger" || settings.navStyle === "both";
  const showTabs =
    isMobile && (settings.navStyle === "tabs" || settings.navStyle === "both");

  // Tab bar height for FAB offset
  const tabBarHeight = showTabs ? 56 : 0;

  // Mobile: show filtered single column based on active tab
  const mobileItems = useMemo(() => {
    if (mobileTab === "tasks") return tasks;
    if (mobileTab === "notes") return notes;
    return done;
  }, [mobileTab, tasks, notes, done]);

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
        className="flex items-center justify-between px-3 md:px-6 py-2 border-b safe-top"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-4">
          {/* Burger menu */}
          {showBurger && (
            <Drawer
              boards={boards}
              currentBoard={currentBoard}
              onSelectBoard={setSelectedBoard}
              onOpenSettings={() => setShowSettings(true)}
              onLogout={logout}
              username={user.data?.username}
            />
          )}

          <h1
            className="text-base md:text-lg font-bold"
            style={{ color: "var(--color-accent)" }}
          >
            ⚡ Taskbook
          </h1>

          {/* Board selector (hidden on mobile with tabs — use drawer instead) */}
          <div className="hidden md:block relative">
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

          {/* Mobile board indicator */}
          <span
            className="md:hidden text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            @{currentBoard}
          </span>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          {/* Search icon */}
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className="flex items-center justify-center cursor-pointer border-none rounded-md"
            style={{
              color: "var(--color-text-muted)",
              background: "none",
              width: 44,
              height: 44,
            }}
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          <span
            className="hidden md:inline text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {user.data?.username}
          </span>

          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center justify-center cursor-pointer border-none rounded-md"
            style={{
              color: "var(--color-text-muted)",
              background: "none",
              width: 44,
              height: 44,
            }}
            title="Refresh"
          >
            <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />
          </button>

          {/* Logout only on desktop (mobile uses drawer) */}
          {!isMobile && (
            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center cursor-pointer border-none rounded-md"
              style={{
                color: "var(--color-text-muted)",
                background: "none",
                width: 44,
                height: 44,
              }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Board content */}
      {isMobile ? (
        /* ── Mobile: single column filtered by active tab ── */
        <main
          className="flex-1 px-3 py-4 overflow-y-auto"
          style={{ paddingBottom: tabBarHeight + 80 }}
        >
          <MobileColumn
            items={mobileItems}
            tab={mobileTab}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
          />
        </main>
      ) : (
        /* ── Desktop: 3-column layout ── */
        <main className="flex-1 p-6 grid grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
          <Column
            title="Tasks"
            icon={<CheckSquare size={16} />}
            items={tasks}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-warning)"
          />
          <Column
            title="Notes"
            icon={<StickyNote size={16} />}
            items={notes}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-info)"
          />
          <Column
            title="Done"
            icon={<CheckSquare size={16} />}
            items={done}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-success)"
          />
        </main>
      )}

      {/* Desktop footer */}
      {!isMobile && (
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
      )}

      {/* Mobile tab bar */}
      {showTabs && (
        <MobileTabs
          active={mobileTab}
          onChange={setMobileTab}
          counts={{
            tasks: tasks.length,
            notes: notes.length,
            done: done.length,
          }}
        />
      )}

      {/* FAB */}
      <Fab
        onClick={() => setShowCreateSheet(true)}
        bottomOffset={tabBarHeight}
      />

      {/* Create item bottom sheet */}
      <CreateItemSheet
        open={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onCreateTask={createTask}
        onCreateNote={createNote}
        boards={boards.length > 0 ? boards : ["My Board"]}
        defaultBoard={currentBoard}
      />

      {/* Settings dialog */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Command palette */}
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

/* ── Mobile single-column view ─────────────────────────── */
function MobileColumn({
  items,
  tab,
  onToggleComplete,
  onToggleStar,
}: {
  items: StorageItem[];
  tab: MobileTab;
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
}) {
  const labels: Record<MobileTab, string> = {
    tasks: "Tasks",
    notes: "Notes",
    done: "Done",
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 mb-3 pb-2 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          {labels[tab]}
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
            className="text-sm py-8 text-center"
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

/* ── Desktop column ────────────────────────────────────── */
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
