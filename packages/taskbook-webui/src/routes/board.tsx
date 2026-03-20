import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  ChevronDown,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AllBoardsView } from "../components/ui/all-boards-view";
import { CommandPalette } from "../components/ui/command-palette";
import { CreateItemSheet } from "../components/ui/create-item-sheet";
import { DashboardLayout } from "../components/ui/dashboard-layout";
import { Drawer } from "../components/ui/drawer";
import { Fab } from "../components/ui/fab";
import { FooterBar, type ViewMode } from "../components/ui/footer-bar";
import { HelpModal } from "../components/ui/help-modal";
import { type MobileTab, MobileTabs } from "../components/ui/mobile-tabs";
import { ProfileMenu } from "../components/ui/profile-menu";
import { RadialActionMenu } from "../components/ui/radial-action-menu";
import { SettingsDialog } from "../components/ui/settings-dialog";
import { SyncStatusButton } from "../components/ui/sync-status-button";
import { TaskCard } from "../components/ui/task-card";
import { TaskbookLogo } from "../components/ui/taskbook-logo";
import { useBoards } from "../hooks/useBoards";
import { useArchive, useEventSync, useItems, useUser } from "../hooks/useItems";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import {
  isBoardsMetadata,
  isTask,
  type NoteItem,
  type StorageItem,
  type TaskItem,
} from "../lib/types";

export function BoardPage() {
  const { token, encryptionKey, setCredentials, logout } = useAuth();
  const {
    items,
    itemsList,
    isLoading,
    refetch,
    updateItems,
    isUpdating,
    syncState,
    lastSyncTime,
    syncError,
  } = useItems();
  const { archiveItems, archiveList, updateArchive, isArchiveLoading } =
    useArchive();
  const user = useUser();
  useEventSync();

  const { settings, isMobile } = useSettings();

  // Board management via synced metadata (replaces localStorage)
  const {
    boards,
    itemBoards,
    addCustomBoard,
    deleteCustomBoard: deleteBoard,
    renameCustomBoard: renameBoard,
  } = useBoards(items, updateItems);

  // Filter out metadata items for display
  const displayItems = useMemo(
    () => itemsList.filter((i) => !isBoardsMetadata(i)),
    [itemsList],
  );

  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("tasks");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem("tb_view_mode");
      if (
        stored === "board" ||
        stored === "all-boards" ||
        stored === "dashboard"
      )
        return stored;
    } catch {
      /* ignore */
    }
    return "all-boards";
  });

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem("tb_view_mode", viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const currentBoard = selectedBoard ?? boards[0] ?? "My Board";

  const boardItems = useMemo(() => {
    return displayItems.filter((item) => item.boards.includes(currentBoard));
  }, [displayItems, currentBoard]);

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
      updated[String(item._id)] = { ...item, isComplete: !item.isComplete };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const toggleStar = useCallback(
    (item: StorageItem) => {
      const updated = { ...items };
      updated[String(item._id)] = { ...item, isStarred: !item.isStarred };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const deleteItem = useCallback(
    (item: StorageItem) => {
      const updated = { ...items };
      delete updated[String(item._id)];
      updateItems(updated);
    },
    [items, updateItems],
  );

  const editItem = useCallback(
    (item: StorageItem, newDescription: string) => {
      const updated = { ...items };
      updated[String(item._id)] = { ...item, description: newDescription };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const toggleProgress = useCallback(
    (item: StorageItem) => {
      if (!isTask(item)) return;
      const updated = { ...items };
      updated[String(item._id)] = { ...item, inProgress: !item.inProgress };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const changePriority = useCallback(
    (item: StorageItem, newPriority: number) => {
      if (!isTask(item)) return;
      const updated = { ...items };
      updated[String(item._id)] = { ...item, priority: newPriority };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const moveToBoard = useCallback(
    (item: StorageItem, targetBoard: string) => {
      const updated = { ...items };
      updated[String(item._id)] = { ...item, boards: [targetBoard] };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const updateTags = useCallback(
    (item: StorageItem, newTags: string[]) => {
      const updated = { ...items };
      updated[String(item._id)] = { ...item, tags: newTags };
      updateItems(updated);
    },
    [items, updateItems],
  );

  const archiveItem = useCallback(
    (item: StorageItem) => {
      const updatedItems = { ...items };
      delete updatedItems[String(item._id)];
      updateItems(updatedItems);
      const updatedArchive = { ...archiveItems, [String(item._id)]: item };
      updateArchive(updatedArchive);
    },
    [items, archiveItems, updateItems, updateArchive],
  );

  const restoreItem = useCallback(
    (item: StorageItem) => {
      const updatedArchive = { ...archiveItems };
      delete updatedArchive[String(item._id)];
      updateArchive(updatedArchive);
      const updatedItems = { ...items, [String(item._id)]: item };
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
      delete updatedItems[String(item._id)];
      updatedArchive[String(item._id)] = item;
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
      const maxId = itemsList.reduce((max, i) => Math.max(max, i._id), 0);
      const newTask: TaskItem = {
        _id: maxId + 1,
        _date: new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        _timestamp: Date.now(),
        _isTask: true,
        description,
        isStarred: false,
        isComplete: false,
        inProgress: false,
        priority,
        boards: [board],
        tags: [],
      };
      const updated = { ...items, [String(newTask._id)]: newTask };
      updateItems(updated);
    },
    [items, itemsList, updateItems],
  );

  const createNote = useCallback(
    (description: string, board: string) => {
      const maxId = itemsList.reduce((max, i) => Math.max(max, i._id), 0);
      const newNote: NoteItem = {
        _id: maxId + 1,
        _date: new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        _timestamp: Date.now(),
        _isTask: false,
        description,
        isStarred: false,
        boards: [board],
        tags: [],
      };
      const updated = { ...items, [String(newNote._id)]: newNote };
      updateItems(updated);
    },
    [items, itemsList, updateItems],
  );

  // Cycle view mode: board → all-boards → dashboard → board
  const cycleView = useCallback(() => {
    setViewMode((prev) => {
      const modes: ViewMode[] = ["board", "all-boards", "dashboard"];
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  // Any modal open? (disable keyboard shortcuts when typing)
  const anyModalOpen =
    showCommandPalette ||
    showCreateSheet ||
    showSettings ||
    showArchiveView ||
    showHelp;

  // Keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    actions: {
      onToggleHelp: () => setShowHelp((prev) => !prev),
      onSearch: () => setShowCommandPalette(true),
      onNewItem: () => setShowCreateSheet(true),
      onToggleView: cycleView,
      onRefresh: () => refetch(),
      onViewBoard: () => setViewMode("board"),
      onViewAllBoards: () => setViewMode("all-boards"),
      onViewDashboard: () => setViewMode("dashboard"),
    },
    disabled: anyModalOpen,
  });

  // ESC key handler: close any open modal/view
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHelp) setShowHelp(false);
        else if (showArchiveView) setShowArchiveView(false);
        else if (showSettings) setShowSettings(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showArchiveView, showSettings, showHelp]);

  // Stats for footer bar
  const footerStats = useMemo(() => {
    const t = displayItems.filter((i) => isTask(i) && !i.isComplete).length;
    const d = displayItems.filter((i) => isTask(i) && i.isComplete).length;
    const n = displayItems.filter((i) => !isTask(i)).length;
    return { tasks: t, done: d, notes: n };
  }, [displayItems]);

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
                <div key={item._id} className="flex items-center gap-2">
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
              onOpenArchive={() => setShowArchiveView(true)}
              onAddBoard={addCustomBoard}
              onDeleteBoard={deleteBoard}
              onRenameBoard={renameBoard}
              itemBoards={itemBoards}
            />
          )}

          <a
            href="/"
            className="flex items-center gap-1.5 no-underline"
            style={{ color: "var(--color-accent)" }}
          >
            <TaskbookLogo size={20} />
            <h1
              className="text-base md:text-lg font-bold"
              style={{ color: "var(--color-accent)", margin: 0 }}
            >
              Taskbook
            </h1>
          </a>

          {/* Board selector — only in board view mode */}
          {viewMode === "board" ? (
            <div className="relative">
              <select
                value={currentBoard}
                onChange={(e) => setSelectedBoard(e.target.value)}
                className="appearance-none pr-6 pl-2 md:pr-8 md:pl-3 py-1 md:py-1.5 rounded text-xs md:text-sm cursor-pointer border-none"
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
                size={12}
                className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--color-text-muted)" }}
              />
            </div>
          ) : (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text-muted)",
              }}
            >
              {viewMode === "all-boards" ? "All Boards" : "Dashboard"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2">
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

          {/* Profile avatar menu */}
          <ProfileMenu
            username={user.data?.username}
            email={user.data?.email}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={logout}
          />

          {/* Sync status button (replaces separate ConnectionIndicator + RefreshCw) */}
          <SyncStatusButton
            syncState={syncState}
            lastSyncTime={lastSyncTime}
            syncError={syncError}
            isUpdating={isUpdating}
            onRefresh={() => refetch()}
          />
        </div>
      </header>

      {/* Board content — view-mode aware */}
      {viewMode === "all-boards" ? (
        /* ── All Boards: stacked vertically like TUI ── */
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: isMobile ? tabBarHeight + 80 : 44 }}
        >
          <AllBoardsView
            items={displayItems}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            {...columnCallbacks}
          />
        </main>
      ) : viewMode === "board" ? (
        isMobile ? (
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
          <main
            className="flex-1 p-4 md:p-6 lg:p-8 grid grid-cols-3 gap-4 md:gap-6 lg:gap-8 w-full"
            style={{ paddingBottom: 44 }}
          >
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
        )
      ) : (
        /* ── Dashboard: widget layout ── */
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: isMobile ? tabBarHeight + 80 : 44 }}
        >
          <DashboardLayout
            items={displayItems}
            boards={boards}
            onAddItem={(description, isTaskItem, board) => {
              if (isTaskItem) {
                createTask(description, board, 1);
              } else {
                createNote(description, board);
              }
            }}
            onToggleComplete={toggleComplete}
            onToggleStar={toggleStar}
            onDelete={deleteItem}
            onEdit={editItem}
            onToggleProgress={toggleProgress}
            onChangePriority={changePriority}
            onMoveToBoard={moveToBoard}
            onUpdateTags={updateTags}
            onArchive={archiveItem}
            archiveItems={archiveList}
            onRestoreItem={restoreItem}
          />
        </main>
      )}

      {/* Footer bar with keyboard shortcuts */}
      <FooterBar
        shortcuts={shortcuts}
        viewMode={viewMode}
        stats={footerStats}
      />

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

      {/* FAB (desktop only) / Radial action menu (touch/mobile) */}
      {isMobile ? (
        <RadialActionMenu
          onNewTask={() => setShowCreateSheet(true)}
          onNewNote={() => setShowCreateSheet(true)}
          onSearch={() => setShowCommandPalette(true)}
          onSync={() => refetch()}
          onViewBoard={() => setViewMode("board")}
          onViewAllBoards={() => setViewMode("all-boards")}
          onViewDashboard={() => setViewMode("dashboard")}
          onOpenArchive={() => setShowArchiveView(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHelp={() => setShowHelp(true)}
          bottomOffset={tabBarHeight}
        />
      ) : (
        <Fab
          onClick={() => setShowCreateSheet(true)}
          bottomOffset={tabBarHeight}
        />
      )}

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
        onKeyImport={(key) => {
          if (token) {
            setCredentials(token, key);
            api.storeEncryptionKey(token, key);
          }
        }}
        onKeyReset={() => {
          if (token) {
            api.resetEncryptionKey(token);
            setCredentials(token, null);
          }
        }}
      />

      {/* Command palette */}
      {showCommandPalette && (
        <CommandPalette
          items={displayItems}
          boards={boards}
          onClose={() => setShowCommandPalette(false)}
          onSelectBoard={setSelectedBoard}
        />
      )}

      {/* Help modal */}
      <HelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcuts}
      />
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
              key={item._id}
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
              key={item._id}
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
