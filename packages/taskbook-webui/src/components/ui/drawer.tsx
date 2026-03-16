import {
  Archive,
  Folder,
  LogOut,
  Menu,
  Plus,
  Settings,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface DrawerProps {
  boards: string[];
  currentBoard: string;
  onSelectBoard: (board: string) => void;
  onOpenSettings: () => void;
  onOpenArchive: () => void;
  onLogout: () => void;
  onAddBoard: (name: string) => void;
  username?: string;
  email?: string;
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
  onOpenSettings,
  onOpenArchive,
  onLogout,
  onAddBoard,
  username,
  email,
}: DrawerProps) {
  const [open, setOpen] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

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

            {/* User info */}
            {(username || email) && (
              <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: "var(--color-border)" }}
              >
                <User
                  size={18}
                  className="shrink-0"
                  style={{ color: "var(--color-text-muted)" }}
                />
                <div className="min-w-0">
                  {username && (
                    <span
                      className="text-sm truncate block"
                      style={{ color: "var(--color-text)" }}
                    >
                      {username}
                    </span>
                  )}
                  {email && (
                    <span
                      className="text-xs truncate block"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {email}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Boards */}
            <div className="flex-1 overflow-y-auto py-2">
              <div
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Boards
              </div>
              {boards.map((board) => (
                <button
                  key={board}
                  type="button"
                  onClick={() => {
                    onSelectBoard(board);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer border-none"
                  style={{
                    color:
                      board === currentBoard
                        ? "var(--color-accent)"
                        : "var(--color-text)",
                    backgroundColor:
                      board === currentBoard
                        ? "var(--color-surface-hover)"
                        : "transparent",
                    minHeight: 44,
                  }}
                >
                  <Folder size={16} />
                  <span className="text-sm">@{board}</span>
                </button>
              ))}

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
                        setOpen(false);
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
                  setOpen(false);
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
              <button
                type="button"
                aria-label="Settings"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer border-none"
                style={{
                  color: "var(--color-text)",
                  background: "none",
                  minHeight: 44,
                }}
              >
                <Settings size={16} />
                <span className="text-sm">Settings</span>
              </button>
              <button
                type="button"
                aria-label="Logout"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer border-none"
                style={{
                  color: "var(--color-error)",
                  background: "none",
                  minHeight: 44,
                }}
              >
                <LogOut size={16} />
                <span className="text-sm">Logout</span>
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
