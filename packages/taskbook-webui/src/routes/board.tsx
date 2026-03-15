import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  ChevronDown,
  LogOut,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CommandPalette } from "../components/ui/command-palette";
import { ConnectionIndicator } from "../components/ui/connection-indicator";
import { CreateItemSheet } from "../components/ui/create-item-sheet";
import { Drawer } from "../components/ui/drawer";
import { Fab } from "../components/ui/fab";
import { type MobileTab, MobileTabs } from "../components/ui/mobile-tabs";
import { SettingsDialog } from "../components/ui/settings-dialog";
import { TaskCard } from "../components/ui/task-card";
import { useArchive, useEventSync, useItems, useUser } from "../hooks/useItems";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import {
  getBoards,
  isTask,
  type NoteItem,
  type StorageItem,
  type TaskItem,
} from "../lib/types";

export function BoardPage() {
  const { token, encryptionKey, setCredentials, logout } = useAuth();
  const { items, itemsList, isLoading, refetch, updateItems, isUpdating } =
    useItems();
  const { archiveItems, archiveList, updateArchive, isArchiveLoading } =
    useArchive();
  const user = useUser();
  useEventSync();

  const { settings, isMobile } = useSettings();

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("tasks");
  const [username, setUsername] = useState<string | undefined>(undefined);

  // Keep username in sync with user query data
  const displayUsername = username ?? user.data?.username;
  const userEmail = user.data?.email;

  // Custom boards stored in localStorage for empty boards
  const [customBoards, setCustomBoards] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("tb_custom_boards");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const itemBoards = useMemo(() => getBoards(itemsList), [itemsList]);
  const boards = useMemo(() => {
    const all = new Set([...itemBoards, ...customBoards]);
    return Array.from(all).sort();
  }, [itemBoards, customBoards]);

  const currentBoard = selectedBoard ?? boards[0] ?? "My Board";

  const addCustomBoard = useCallback((name: string) => {
    setCustomBoards((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      localStorage.setItem("tb_custom_boards", JSON.stringify(next));
      return next;
    });
  }, []);

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

  // ── Item callbacks ──

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

  const deleteItem = useCallback(
    (item: StorageItem) => {
      const updated = { ...items };
      delete updated[String(item.id)];
      updateItems(updated);
    },
    [items, updateItems],
  );

  const editItem = useCallback(
    (item: StorageItem, newDescription: string) => {
      const updated = { ...items };
      updated[String(item.id)] = { ...item, description: newDescription };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const toggleProgress = useCallback(
    (item: StorageItem) => {
      if (!isTask(item)) return;
      const updated = { ...items };
      updated[String(item.id)] = { ...item, inProgress: !item.inProgress };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const changePriority = useCallback(
    (item: StorageItem, newPriority: number) => {
      if (!isTask(item)) return;
      const updated = { ...items };
      updated[String(item.id)] = { ...item, priority: newPriority };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const moveToBoard = useCallback(
    (item: StorageItem, targetBoard: string) => {
      const updated = { ...items };
      updated[String(item.id)] = { ...item, boards: [targetBoard] };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const updateTags = useCallback(
    (item: StorageItem, newTags: string[]) => {
      const updated = { ...items };
      updated[String(item.id)] = { ...item, tags: newTags };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const archiveItem = useCallback(
    (item: StorageItem) => {
      const updatedItems = { ...items };
      delete updatedItems[String(item.id)];
      updateItems(updatedItems);
      const updatedArchive = { ...archiveItems, [String(item.id)]: item };
      updateArchive(updatedArchive);
    },
    [items, archiveItems, updateItems, updateArchive],
  );

  const restoreItem = useCallback(
    (item: StorageItem) => {
      const updatedArchive = { ...archiveItems };
      delete updatedArchive[String(item.id)];
      updateArchive(updatedArchive);
      const updatedItems = { ...items, [String(item.id)]: item };
      updateItems(updatedItems);
    },
    [items, archiveItems, updateItems, updateArchive],
  );

  const clearChecked = useCallback(() => {
    const completedItems = itemsList.filter(
      (i) => isTask(i) && i.isComplete && i.boards.includes(currentBoard),
    );
    if (completedItems.length === 0) return;

    const updatedItems = { ...items };
    const updatedArchive = { ...archiveItems };
    for (const item of completedItems) {
      delete updatedItems[String(item.id)];
      updatedArchive[String(item.id)] = item;
    }
    updateItems(updatedItems);
    updateArchive(updatedArchive);
  }, [
    items,
    archiveItems,
    itemsList,
    currentBoard,
    updateItems,
    updateArchive,
  ]);

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

  // Shared column callback props
  const columnCallbacks = {
    onDelete: deleteItem,
    onEdit: editItem,
    onToggleProgress: toggleProgress,
    onChangePriority: changePriority,
    onMoveToBoard: moveToBoard,
    onUpdateTags: updateTags,
    onArchive: archiveItem,
    boards,
  };

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

  // ── Archive view ──
  if (showArchiveView) {
    return (
      <div className="min-h-screen flex flex-col">
        <header
          className="flex items-center justify-between px-3 md:px-6 py-2 border-b safe-top"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setShowArchiveView(false)}
              className="flex items-center justify-center cursor-pointer border-none rounded-md"
              style={{
                color: "var(--color-text-muted)",
                background: "none",
                width: 44,
                height: 44,
              }}
            >
              ←
            </button>
            <h1
              className="text-base md:text-lg font-bold"
              style={{ color: "var(--color-accent)" }}
            >
              <Archive size={16} className="inline mr-2" />
              Archive
            </h1>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full">
          {isArchiveLoading ? (
            <div
              className="text-center py-8 animate-pulse"
              style={{ color: "var(--color-text-muted)" }}
            >
              Loading archive...
            </div>
          ) : archiveList.length === 0 ? (
            <p
              className="text-sm py-8 text-center"
              style={{ color: "var(--color-text-muted)" }}
            >
              No archived items
            </p>
          ) : (
            <div className="space-y-2">
              {archiveList.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TaskCard
                      item={item}
                      onToggleComplete={() => {}}
                      onToggleStar={() => {}}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreItem(item)}
                    className="flex items-center gap-1 px-3 py-2 rounded text-xs cursor-pointer border-none shrink-0"
                    style={{
                      backgroundColor: "var(--color-accent)",
                      color: "white",
                      minHeight: 44,
                    }}
                    title="Restore"
                  >
                    <ArchiveRestore size={14} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
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
              onOpenArchive={() => setShowArchiveView(true)}
              onLogout={logout}
              onAddBoard={addCustomBoard}
              username={user.data?.username}
              email={user.data?.email}
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
          {/* Archive button (desktop) */}
          {!isMobile && (
            <button
              type="button"
              onClick={() => setShowArchiveView(true)}
              className="flex items-center justify-center cursor-pointer border-none rounded-md"
              style={{
                color: "var(--color-text-muted)",
                background: "none",
                width: 44,
                height: 44,
              }}
              title="Archive"
            >
              <Archive size={16} />
            </button>
          )}

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

          <ConnectionIndicator />

          <span
            className="hidden md:inline text-xs md:text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            {user.data?.username}
            {user.data?.email && user.data.email !== user.data.username && (
              <span className="hidden lg:inline text-xs ml-1 opacity-70">
                ({user.data.email})
              </span>
            )}
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
            onClearChecked={mobileTab === "done" ? clearChecked : undefined}
            doneCount={mobileTab === "done" ? done.length : 0}
            {...columnCallbacks}
          />
        </main>
      ) : (
        /* ── Desktop: 3-column layout ── */
        <main className="flex-1 p-4 md:p-6 lg:p-8 grid grid-cols-3 gap-4 md:gap-6 lg:gap-8 w-full">
          <Column
            title="Tasks"
            icon={<CheckSquare size={16} />}
            items={tasks}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-warning)"
            {...columnCallbacks}
          />
          <Column
            title="Notes"
            icon={<StickyNote size={16} />}
            items={notes}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-info)"
            {...columnCallbacks}
          />
          <Column
            title="Done"
            icon={<CheckSquare size={16} />}
            items={done}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            accentColor="var(--color-success)"
            onClearChecked={clearChecked}
            {...columnCallbacks}
          />
        </main>
      )}

      {/* Desktop footer */}
      {!isMobile && (
        <footer
          className="px-6 lg:px-8 py-2 text-center text-xs md:text-sm border-t"
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
        onAddBoard={addCustomBoard}
      />

      {/* Settings dialog */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        token={token ?? undefined}
        encryptionKey={encryptionKey ?? undefined}
        username={displayUsername}
        email={userEmail}
        onKeyImport={(key) => {
          if (token) {
            setCredentials(token, key);
            api.storeEncryptionKey(token, key);
          }
        }}
        onKeyReset={() => {
          if (token) {
            api.resetEncryptionKey(token);
            setCredentials(token, "");
          }
        }}
        onUsernameChange={(newName) => {
          if (token) {
            api
              .updateMe(token, { username: newName })
              .then((u) => setUsername(u.username));
          }
        }}
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

/* ── Shared column callback types ─────────────────────── */
interface ColumnCallbacks {
  onDelete: (item: StorageItem) => void;
  onEdit: (item: StorageItem, desc: string) => void;
  onToggleProgress: (item: StorageItem) => void;
  onChangePriority: (item: StorageItem, p: number) => void;
  onMoveToBoard: (item: StorageItem, board: string) => void;
  onUpdateTags: (item: StorageItem, tags: string[]) => void;
  onArchive: (item: StorageItem) => void;
  boards: string[];
}

/* ── Mobile single-column view ─────────────────────────── */
function MobileColumn({
  items,
  tab,
  onToggleComplete,
  onToggleStar,
  onClearChecked,
  doneCount,
  ...callbacks
}: {
  items: StorageItem[];
  tab: MobileTab;
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
  onClearChecked?: () => void;
  doneCount: number;
} & ColumnCallbacks) {
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
        {onClearChecked && doneCount > 0 && (
          <button
            type="button"
            onClick={onClearChecked}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-surface-hover)",
              color: "var(--color-text-muted)",
              minHeight: 32,
            }}
            title="Archive all completed"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
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
              onDelete={() => callbacks.onDelete(item)}
              onEdit={(desc) => callbacks.onEdit(item, desc)}
              onToggleProgress={() => callbacks.onToggleProgress(item)}
              onChangePriority={(p) => callbacks.onChangePriority(item, p)}
              onMoveToBoard={(b) => callbacks.onMoveToBoard(item, b)}
              onUpdateTags={(tags) => callbacks.onUpdateTags(item, tags)}
              onArchive={() => callbacks.onArchive(item)}
              boards={callbacks.boards}
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
  onClearChecked,
  ...callbacks
}: {
  title: string;
  icon: React.ReactNode;
  items: StorageItem[];
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
  accentColor: string;
  onClearChecked?: () => void;
} & ColumnCallbacks) {
  return (
    <div>
      <div
        className="flex items-center gap-2 mb-3 pb-2 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <h2
          className="text-sm md:text-base font-semibold"
          style={{ color: accentColor }}
        >
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
        {onClearChecked && items.length > 0 && (
          <button
            type="button"
            onClick={onClearChecked}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-surface-hover)",
              color: "var(--color-text-muted)",
              minHeight: 32,
            }}
            title="Archive all completed"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p
            className="text-xs md:text-sm py-4 text-center"
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
              onDelete={() => callbacks.onDelete(item)}
              onEdit={(desc) => callbacks.onEdit(item, desc)}
              onToggleProgress={() => callbacks.onToggleProgress(item)}
              onChangePriority={(p) => callbacks.onChangePriority(item, p)}
              onMoveToBoard={(b) => callbacks.onMoveToBoard(item, b)}
              onUpdateTags={(tags) => callbacks.onUpdateTags(item, tags)}
              onArchive={() => callbacks.onArchive(item)}
              boards={callbacks.boards}
            />
          ))
        )}
      </div>
    </div>
  );
}
