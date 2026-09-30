import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  Copy,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../../lib/settings";
import { isTask, type StorageItem } from "../../lib/types";

interface TaskCardProps {
  item: StorageItem;
  onToggleComplete: () => void;
  onToggleStar: () => void;
  onDelete?: () => void;
  onEdit?: (newDescription: string) => void;
  onToggleProgress?: () => void;
  onChangePriority?: (newPriority: number) => void;
  onMoveToBoard?: (board: string) => void;
  onUpdateTags?: (tags: string[]) => void;
  onArchive?: () => void;
  boards?: string[];
  compact?: boolean;
}

export function TaskCard({
  item,
  onToggleComplete,
  onToggleStar,
  onDelete,
  onEdit,
  onToggleProgress,
  onChangePriority,
  onUpdateTags,
  onMoveToBoard,
  onArchive,
  boards,
  compact,
}: TaskCardProps) {
  const { settings, isMobile } = useSettings();
  const task = isTask(item);
  const complete = task && item.isComplete;

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.description);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Tag add state
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Move dropdown state
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Mobile context menu
  const [showContextMenu, setShowContextMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe gesture state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const swiping = useRef(false);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (addingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [addingTag]);

  const startEdit = useCallback(() => {
    setEditText(item.description);
    setEditing(true);
  }, [item.description]);

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.description) {
      onEdit?.(trimmed);
    }
    setEditing(false);
  }, [editText, item.description, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditText(item.description);
  }, [item.description]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
    setSwiped(false);

    // Long press for context menu / edit
    longPressTimer.current = setTimeout(() => {
      setShowContextMenu(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // Cancel long press on move
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!settings.swipeGestures || !task) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dy > 30 && !swiping.current) return;
      if (dx > 10) {
        swiping.current = true;
        setSwipeX(Math.min(dx, 120));
      }
    },
    [settings.swipeGestures, task],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (swipeX > 80 && task) {
      setSwiped(true);
      setTimeout(() => {
        onToggleComplete();
        setSwipeX(0);
        setSwiped(false);
      }, 200);
    } else {
      setSwipeX(0);
    }
    swiping.current = false;
  }, [swipeX, task, onToggleComplete]);

  const cyclePriority = useCallback(() => {
    if (!task) return;
    const next = ((item as { priority: number }).priority + 1) % 4;
    onChangePriority?.(next);
  }, [task, item, onChangePriority]);

  const removeTag = useCallback(
    (tag: string) => {
      onUpdateTags?.(item.tags.filter((t) => t !== tag));
    },
    [item.tags, onUpdateTags],
  );

  const addTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !item.tags.includes(trimmed)) {
      onUpdateTags?.([...item.tags, trimmed]);
    }
    setNewTag("");
    setAddingTag(false);
  }, [newTag, item.tags, onUpdateTags]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(item.description);
  }, [item.description]);

  const py = compact ? "py-1" : settings.compactCards ? "py-1.5" : "py-3";
  const inProgress = task && item.inProgress;

  return (
    <div
      className="relative overflow-hidden rounded-md"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe reveal background */}
      {swipeX > 0 && (
        <div
          className="absolute inset-0 flex items-center pl-4 rounded-md"
          style={{
            backgroundColor: swiped
              ? "var(--color-success)"
              : "var(--color-surface-hover)",
          }}
        >
          <CheckCircle2
            size={20}
            style={{
              color:
                swipeX > 80
                  ? "var(--color-success)"
                  : "var(--color-text-muted)",
            }}
          />
          <span
            className="ml-2 text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {swipeX > 80 ? (complete ? "Undo" : "Complete") : ""}
          </span>
        </div>
      )}

      <div
        className={`flex items-start ${compact ? "gap-2 px-2 text-xs" : "gap-3 px-3"} ${py} transition-colors group cursor-default relative`}
        style={{
          backgroundColor: "var(--color-surface)",
          transform: `translateX(${swipeX}px)`,
          transition: swiping.current ? "none" : "transform 0.2s ease-out",
          borderLeft: inProgress
            ? "3px solid var(--color-info)"
            : "3px solid transparent",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface)")
        }
      >
        {/* Checkbox / bullet */}
        {task ? (
          <button
            type="button"
            onClick={onToggleComplete}
            className="flex items-center justify-center cursor-pointer border-none p-0"
            style={{
              color: complete
                ? "var(--color-success)"
                : "var(--color-text-muted)",
              background: "none",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            {complete ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
        ) : (
          <span
            className="flex items-center justify-center"
            style={{
              color: "var(--color-info)",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            •
          </span>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 py-2">
          {editing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={commitEdit}
              className="w-full text-sm p-1 rounded border-none outline-none"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            />
          ) : (
            <p
              className={`text-sm ${complete ? "line-through" : ""}`}
              style={{
                color: complete
                  ? "var(--color-text-muted)"
                  : "var(--color-text)",
              }}
              onDoubleClick={() => !isMobile && onEdit && startEdit()}
            >
              {item.description}
              {inProgress && (
                <span
                  className="inline-block w-2 h-2 rounded-full ml-2 align-middle"
                  style={{
                    backgroundColor: "var(--color-info)",
                    animation: "pulse 2s infinite",
                  }}
                />
              )}
            </p>
          )}

          {/* Tags */}
          {(item.tags.length > 0 || addingTag) && (
            <div className="flex gap-1 mt-1 flex-wrap items-center">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-accent)",
                  }}
                >
                  +{tag}
                  {onUpdateTags && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="cursor-pointer border-none p-0 ml-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      style={{
                        background: "none",
                        color: "var(--color-text-muted)",
                        lineHeight: 1,
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              {addingTag ? (
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag();
                    if (e.key === "Escape") {
                      setAddingTag(false);
                      setNewTag("");
                    }
                  }}
                  onBlur={addTag}
                  placeholder="tag"
                  className="text-xs px-1.5 py-0.5 rounded border-none outline-none w-16"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                  }}
                />
              ) : (
                onUpdateTags && (
                  <button
                    type="button"
                    onClick={() => setAddingTag(true)}
                    className="text-xs px-1 py-0.5 rounded cursor-pointer border-none md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    style={{
                      background: "none",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <Plus size={10} />
                  </button>
                )
              )}
            </div>
          )}
          {item.tags.length === 0 && !addingTag && onUpdateTags && (
            <button
              type="button"
              onClick={() => setAddingTag(true)}
              className="text-xs mt-1 cursor-pointer border-none md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              style={{ background: "none", color: "var(--color-text-muted)" }}
            >
              <Plus size={10} className="inline mr-0.5" />
              tag
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 py-2">
          {/* Play/Pause for tasks */}
          {task && onToggleProgress && (
            <ActionButton
              onClick={onToggleProgress}
              title={inProgress ? "Pause" : "Start"}
              hoverOnly
            >
              {inProgress ? <Pause size={14} /> : <Play size={14} />}
            </ActionButton>
          )}

          {/* Clickable priority stars */}
          {task && onChangePriority && (
            <button
              type="button"
              onClick={cyclePriority}
              className="flex items-center justify-center cursor-pointer border-none p-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              style={{
                color: "var(--color-warning)",
                background: "none",
                minWidth: 32,
                minHeight: 44,
              }}
              title={`Priority: ${(item as { priority: number }).priority}`}
            >
              <span className="text-xs">
                {(item as { priority: number }).priority === 0
                  ? "☆"
                  : "★".repeat((item as { priority: number }).priority)}
              </span>
            </button>
          )}

          {/* Star */}
          <button
            type="button"
            onClick={onToggleStar}
            className="flex items-center justify-center cursor-pointer border-none p-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            style={{
              color: item.isStarred
                ? "var(--color-warning)"
                : "var(--color-text-muted)",
              background: "none",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <Star size={16} fill={item.isStarred ? "currentColor" : "none"} />
          </button>

          {/* Desktop action buttons (hidden on mobile, shown on hover) */}
          {!isMobile && (
            <>
              <ActionButton onClick={copyToClipboard} title="Copy" hoverOnly>
                <Copy size={14} />
              </ActionButton>

              {onMoveToBoard && boards && boards.length > 1 && (
                <div className="relative">
                  <ActionButton
                    onClick={() => setShowMoveMenu(!showMoveMenu)}
                    title="Move to board"
                    hoverOnly
                  >
                    <ArrowRightLeft size={14} />
                  </ActionButton>
                  {showMoveMenu && (
                    <MoveMenu
                      boards={boards}
                      currentBoards={item.boards}
                      onSelect={(b) => {
                        onMoveToBoard(b);
                        setShowMoveMenu(false);
                      }}
                      onClose={() => setShowMoveMenu(false)}
                    />
                  )}
                </div>
              )}

              {onArchive && (
                <ActionButton onClick={onArchive} title="Archive" hoverOnly>
                  <Archive size={14} />
                </ActionButton>
              )}

              {onDelete && (
                <ActionButton onClick={onDelete} title="Delete" hoverOnly>
                  <Trash2 size={14} />
                </ActionButton>
              )}
            </>
          )}

          {/* Mobile: "..." dropdown for extra actions */}
          {isMobile && (onDelete || onArchive || onMoveToBoard) && (
            <ActionButton
              onClick={() => setShowContextMenu(true)}
              title="More actions"
            >
              <MoreHorizontal size={16} />
            </ActionButton>
          )}
        </div>
      </div>

      {/* Mobile context menu overlay */}
      {showContextMenu && (
        <ContextMenu
          item={item}
          task={task}
          inProgress={!!inProgress}
          boards={boards}
          onEdit={onEdit ? startEdit : undefined}
          onDelete={onDelete}
          onArchive={onArchive}
          onToggleProgress={onToggleProgress}
          onCopy={copyToClipboard}
          onMoveToBoard={onMoveToBoard}
          onClose={() => setShowContextMenu(false)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  children,
  hoverOnly,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  hoverOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center cursor-pointer border-none rounded-md ${hoverOnly ? "md:opacity-0 md:group-hover:opacity-100" : ""} transition-opacity`}
      style={{
        color: "var(--color-text-muted)",
        background: "none",
        minWidth: 32,
        minHeight: 44,
      }}
      title={title}
    >
      {children}
    </button>
  );
}

function MoveMenu({
  boards,
  currentBoards,
  onSelect,
  onClose,
}: {
  boards: string[];
  currentBoards: string[];
  onSelect: (board: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-50 mt-1 py-1 rounded-lg shadow-lg min-w-[140px]"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {boards
        .filter((b) => !currentBoards.includes(b))
        .map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onSelect(b)}
            className="block w-full text-left px-3 py-2 text-xs cursor-pointer border-none"
            style={{ background: "none", color: "var(--color-text)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--color-surface-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            @{b}
          </button>
        ))}
    </div>
  );
}

function ContextMenu({
  item,
  task,
  inProgress,
  boards,
  onEdit,
  onDelete,
  onArchive,
  onToggleProgress,
  onCopy,
  onMoveToBoard,
  onClose,
}: {
  item: StorageItem;
  task: boolean;
  inProgress: boolean;
  boards?: string[];
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onToggleProgress?: () => void;
  onCopy: () => void;
  onMoveToBoard?: (board: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-xl overflow-hidden safe-bottom"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b text-sm font-medium truncate"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {item.description}
        </div>
        <div className="py-1">
          {onEdit && (
            <ContextMenuItem
              label="Edit"
              onClick={() => {
                onClose();
                onEdit();
              }}
            />
          )}
          {task && onToggleProgress && (
            <ContextMenuItem
              label={inProgress ? "Pause" : "Start"}
              onClick={() => {
                onClose();
                onToggleProgress();
              }}
            />
          )}
          <ContextMenuItem
            label="Copy"
            onClick={() => {
              onCopy();
              onClose();
            }}
          />
          {onMoveToBoard &&
            boards
              ?.filter((b) => !item.boards.includes(b))
              .map((b) => (
                <ContextMenuItem
                  key={b}
                  label={`Move to @${b}`}
                  onClick={() => {
                    onMoveToBoard(b);
                    onClose();
                  }}
                />
              ))}
          {onArchive && (
            <ContextMenuItem
              label="Archive"
              onClick={() => {
                onClose();
                onArchive();
              }}
            />
          )}
          {onDelete && (
            <ContextMenuItem
              label="Delete"
              onClick={() => {
                onClose();
                onDelete();
              }}
              danger
            />
          )}
        </div>
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              minHeight: 44,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ContextMenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left px-4 py-3 text-sm cursor-pointer border-none"
      style={{
        background: "none",
        color: danger ? "var(--color-error)" : "var(--color-text)",
        minHeight: 44,
      }}
    >
      {label}
    </button>
  );
}
