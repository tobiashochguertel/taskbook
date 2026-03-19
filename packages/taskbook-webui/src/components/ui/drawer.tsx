import {
  Archive,
  Check,
  Folder,
  Menu,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "../../lib/settings";

interface DrawerProps {
  boards: string[];
  currentBoard: string;
  onSelectBoard: (board: string) => void;
  onOpenArchive: () => void;
  onAddBoard: (name: string) => void;
  onDeleteBoard: (name: string) => void;
  onRenameBoard: (oldName: string, newName: string) => void;
  itemBoards: string[];
}

export function BurgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-md cursor-pointer border-none"
      style={{
        color: "var(--color-text-muted)",
        background: "none",
        width: 44,
        height: 44,
      }}
      aria-label="Open menu"
    >
      <Menu size={22} />
    </button>
  );
}

export function Drawer({
  boards,
  currentBoard,
  onSelectBoard,
  onOpenArchive,
  onAddBoard,
  onDeleteBoard,
  onRenameBoard,
  itemBoards,
}: DrawerProps) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingBoard, setRenamingBoard] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const maybeClose = () => {
    if (settings.autoCloseDrawer) setOpen(false);
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <BurgerButton onClick={() => setOpen(true)} />

      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "var(--color-backdrop)" }}
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <nav
            className="fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col safe-top safe-bottom"
            style={{
              backgroundColor: "var(--color-surface)",
              boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
              animation: "slideInLeft 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: "var(--color-accent)" }}
              >
                ☰ Taskbook
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center cursor-pointer border-none rounded-md"
                style={{
                  color: "var(--color-text-muted)",
                  background: "none",
                  width: 44,
                  height: 44,
                }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Boards */}
            <div className="flex-1 overflow-y-auto py-2">
              <div
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Boards
              </div>
              {boards.map((board) => {
                const hasItems = itemBoards.includes(board);
                const isRenaming = renamingBoard === board;
                return (
                  <div
                    key={board}
                    className="flex items-center group"
                    style={{
                      backgroundColor:
                        board === currentBoard
                          ? "var(--color-surface-hover)"
                          : "transparent",
                    }}
                  >
                    {isRenaming ? (
                      <div className="flex items-center gap-2 flex-1 px-4 py-2">
                        <Folder size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 text-sm px-2 py-1 rounded border-none outline-none"
                          style={{
                            backgroundColor: "var(--color-bg)",
                            color: "var(--color-text)",
                            border: "1px solid var(--color-accent)",
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && renameValue.trim() && renameValue.trim() !== board) {
                              onRenameBoard(board, renameValue.trim());
                              setRenamingBoard(null);
                              setRenameValue("");
                            }
                            if (e.key === "Escape") {
                              setRenamingBoard(null);
                              setRenameValue("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (renameValue.trim() && renameValue.trim() !== board) {
                              onRenameBoard(board, renameValue.trim());
                            }
                            setRenamingBoard(null);
                            setRenameValue("");
                          }}
                          className="flex items-center justify-center cursor-pointer border-none rounded-md"
                          style={{ color: "var(--color-success)", background: "none", width: 28, height: 28 }}
                          title="Confirm rename"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRenamingBoard(null); setRenameValue(""); }}
                          className="flex items-center justify-center cursor-pointer border-none rounded-md"
                          style={{ color: "var(--color-text-muted)", background: "none", width: 28, height: 28 }}
                          title="Cancel rename"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBoard(board);
                            maybeClose();
                          }}
                          className="flex items-center gap-3 flex-1 text-left px-4 py-3 cursor-pointer border-none"
                          style={{
                            color:
                              board === currentBoard
                                ? "var(--color-accent)"
                                : "var(--color-text)",
                            background: "none",
                            minHeight: 44,
                          }}
                        >
                          <Folder size={16} />
                          <span className="text-sm">@{board}</span>
                        </button>
                        {confirmDelete === board ? (
                          <div className="flex items-center gap-1 pr-2">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteBoard(board);
                                setConfirmDelete(null);
                              }}
                              className="px-2 py-1 text-xs rounded cursor-pointer border-none"
                              style={{
                                backgroundColor: "var(--color-error)",
                                color: "white",
                              }}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1 text-xs rounded cursor-pointer border-none"
                              style={{
                                backgroundColor: "var(--color-surface-hover)",
                                color: "var(--color-text-muted)",
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1 transition-opacity">
                            <button
                              type="button"
                              onClick={() => { setRenamingBoard(board); setRenameValue(board); }}
                              className="flex items-center justify-center cursor-pointer border-none rounded-md"
                              style={{
                                color: "var(--color-text-muted)",
                                background: "none",
                                width: 28,
                                height: 28,
                              }}
                              title={`Rename board @${board}`}
                            >
                              <Pencil size={13} />
                            </button>
                            {!hasItems && (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(board)}
                                className="flex items-center justify-center cursor-pointer border-none rounded-md"
                                style={{
                                  color: "var(--color-text-muted)",
                                  background: "none",
                                  width: 28,
                                  height: 28,
                                }}
                                title={`Delete board @${board}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* New board */}
              {showNewBoard ? (
                <div className="px-4 py-2 flex gap-2">
                  <input
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="Board name..."
                    className="flex-1 p-2 rounded text-sm border-none outline-none"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-text)",
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newBoardName.trim()) {
                        onAddBoard(newBoardName.trim());
                        onSelectBoard(newBoardName.trim());
                        setNewBoardName("");
                        setShowNewBoard(false);
                        maybeClose();
                      }
                      if (e.key === "Escape") {
                        setShowNewBoard(false);
                        setNewBoardName("");
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewBoard(true)}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer border-none"
                  style={{
                    color: "var(--color-text-muted)",
                    background: "none",
                    minHeight: 44,
                  }}
                >
                  <Plus size={16} />
                  <span className="text-sm">New Board</span>
                </button>
              )}
            </div>

            {/* Footer actions */}
            <div
              className="border-t py-2 px-2"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                type="button"
                aria-label="Archive"
                onClick={() => {
                  maybeClose();
                  onOpenArchive();
                }}
                className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer border-none"
                style={{
                  color: "var(--color-text)",
                  background: "none",
                  minHeight: 44,
                }}
              >
                <Archive size={16} />
                <span className="text-sm">Archive</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
