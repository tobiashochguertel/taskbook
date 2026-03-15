import { Command } from "cmdk";
import { useEffect, useRef } from "react";
import { isTask, type StorageItem } from "../../lib/types";

interface CommandPaletteProps {
  items: StorageItem[];
  boards: string[];
  onClose: () => void;
  onSelectBoard: (board: string) => void;
}

export function CommandPalette({
  items,
  boards,
  onClose,
  onSelectBoard,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--color-surface)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <Command
          className="flex flex-col"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <Command.Input
            ref={inputRef}
            placeholder="Search items, boards, actions..."
            className="w-full px-4 py-3 text-sm border-b outline-none"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
            }}
          />
          <Command.List className="max-h-64 overflow-y-auto p-2">
            <Command.Empty
              className="py-4 text-center text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              No results
            </Command.Empty>

            <Command.Group
              heading="Boards"
              className="text-xs font-semibold px-2 py-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {boards.map((board) => (
                <Command.Item
                  key={board}
                  value={`board:${board}`}
                  onSelect={() => {
                    onSelectBoard(board);
                    onClose();
                  }}
                  className="px-3 py-2 rounded text-sm cursor-pointer"
                  style={{ color: "var(--color-text)" }}
                  data-selected={false}
                >
                  @{board}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Items"
              className="text-xs font-semibold px-2 py-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {items.slice(0, 20).map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.description}
                  className="px-3 py-2 rounded text-sm cursor-pointer flex items-center gap-2"
                  style={{ color: "var(--color-text)" }}
                >
                  <span
                    style={{
                      color: isTask(item)
                        ? "var(--color-warning)"
                        : "var(--color-info)",
                    }}
                  >
                    {isTask(item) ? "☐" : "•"}
                  </span>
                  {item.description}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
