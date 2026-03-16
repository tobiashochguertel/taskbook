import { ClipboardList, StickyNote } from "lucide-react";
import { useCallback, useState } from "react";
import { BottomSheet } from "./bottom-sheet";

type ItemType = "task" | "note";

interface CreateItemSheetProps {
  open: boolean;
  onClose: () => void;
  onCreateTask: (description: string, board: string, priority: number) => void;
  onCreateNote: (description: string, board: string) => void;
  boards: string[];
  defaultBoard: string;
  onAddBoard?: (name: string) => void;
}

export function CreateItemSheet({
  open,
  onClose,
  onCreateTask,
  onCreateNote,
  boards,
  defaultBoard,
  onAddBoard,
}: CreateItemSheetProps) {
  const [type, setType] = useState<ItemType>("task");
  const [description, setDescription] = useState("");
  const [board, setBoard] = useState(defaultBoard);
  const [priority, setPriority] = useState(1);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const reset = useCallback(() => {
    setDescription("");
    setBoard(defaultBoard);
    setPriority(1);
    setType("task");
  }, [defaultBoard]);

  const handleSubmit = useCallback(() => {
    const desc = description.trim();
    if (!desc) return;

    if (type === "task") {
      onCreateTask(desc, board, priority);
    } else {
      onCreateNote(desc, board);
    }

    reset();
    onClose();
  }, [
    type,
    description,
    board,
    priority,
    onCreateTask,
    onCreateNote,
    reset,
    onClose,
  ]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Create new item">
      {/* Type selector */}
      <div className="flex gap-2 mb-4">
        <TypeButton
          active={type === "task"}
          onClick={() => setType("task")}
          icon={<ClipboardList size={16} />}
          label="Task"
        />
        <TypeButton
          active={type === "note"}
          onClick={() => setType("note")}
          icon={<StickyNote size={16} />}
          label="Note"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            type === "task" ? "What needs to be done?" : "Add a note..."
          }
          className="w-full px-3 py-3 rounded-lg text-sm border outline-none resize-none"
          style={{
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text)",
            borderColor: "var(--color-border)",
            fontFamily: "var(--font-mono)",
            minHeight: 80,
          }}
          rows={3}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
      </div>

      {/* Board */}
      <div className="mb-4">
        <label
          className="block text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          Board
        </label>
        <div className="flex gap-2 flex-wrap">
          {boards.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBoard(b)}
              className="px-3 py-2 rounded-lg text-xs cursor-pointer border-2 transition-colors"
              style={{
                backgroundColor:
                  board === b
                    ? "var(--color-surface-hover)"
                    : "var(--color-bg)",
                borderColor:
                  board === b ? "var(--color-accent)" : "var(--color-border)",
                color:
                  board === b
                    ? "var(--color-accent)"
                    : "var(--color-text-muted)",
                minHeight: 44,
              }}
            >
              @{b}
            </button>
          ))}
          {onAddBoard &&
            (showNewBoard ? (
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name..."
                className="px-3 py-2 rounded-lg text-xs border-2 outline-none"
                style={{
                  backgroundColor: "var(--color-bg)",
                  borderColor: "var(--color-accent)",
                  color: "var(--color-text)",
                  minHeight: 44,
                  width: 120,
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBoardName.trim()) {
                    onAddBoard(newBoardName.trim());
                    setBoard(newBoardName.trim());
                    setNewBoardName("");
                    setShowNewBoard(false);
                  }
                  if (e.key === "Escape") {
                    setShowNewBoard(false);
                    setNewBoardName("");
                  }
                }}
                onBlur={() => {
                  if (newBoardName.trim()) {
                    onAddBoard(newBoardName.trim());
                    setBoard(newBoardName.trim());
                  }
                  setNewBoardName("");
                  setShowNewBoard(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNewBoard(true)}
                className="px-3 py-2 rounded-lg text-xs cursor-pointer border-2 border-dashed transition-colors"
                style={{
                  backgroundColor: "var(--color-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-muted)",
                  minHeight: 44,
                }}
              >
                + New
              </button>
            ))}
        </div>
      </div>

      {/* Priority (tasks only) */}
      {type === "task" && (
        <div className="mb-4">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            Priority
          </label>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="flex-1 py-2 rounded-lg text-sm cursor-pointer border-2 transition-colors"
                style={{
                  backgroundColor:
                    priority === p
                      ? "var(--color-surface-hover)"
                      : "var(--color-bg)",
                  borderColor:
                    priority === p
                      ? "var(--color-warning)"
                      : "var(--color-border)",
                  color:
                    priority === p
                      ? "var(--color-warning)"
                      : "var(--color-text-muted)",
                  minHeight: 44,
                }}
              >
                {p === 0 ? "None" : "★".repeat(p)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        aria-label={type === "task" ? "Create Task" : "Create Note"}
        onClick={handleSubmit}
        disabled={!description.trim()}
        className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer border-none transition-opacity"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-bg)",
          opacity: description.trim() ? 1 : 0.5,
          minHeight: 48,
        }}
      >
        Create {type === "task" ? "Task" : "Note"}
      </button>

      <div
        className="text-center mt-2 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        ⌘+Enter to submit
      </div>
    </BottomSheet>
  );
}

function TypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg cursor-pointer border-2 transition-colors"
      style={{
        backgroundColor: active
          ? "var(--color-surface-hover)"
          : "var(--color-bg)",
        borderColor: active ? "var(--color-accent)" : "var(--color-border)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        minHeight: 44,
      }}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
