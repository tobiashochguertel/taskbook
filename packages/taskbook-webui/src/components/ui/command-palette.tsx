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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 25px 60px -12px var(--color-dialog-shadow)",
        }}
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
            className="w-full px-5 py-4 text-sm md:text-base border-b outline-none"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
            }}
          />
          <Command.List className="max-h-80 overflow-y-auto p-3">
            <Command.Empty
              className="py-8 text-center text-sm md:text-base"
              style={{ color: "var(--color-text-muted)" }}
            >
              No results
            </Command.Empty>

            <Command.Group
              heading="Boards"
              className="text-xs md:text-sm font-semibold px-3 py-2"
              style={{ color: "var(--color-accent)" }}
            >
              {boards.map((board) => (
                <Command.Item
                  key={board}
                  value={`board:${board}`}
                  onSelect={() => {
                    onSelectBoard(board);
                    onClose();
                  }}
                  className="px-4 py-3 rounded-lg text-sm md:text-base cursor-pointer"
                  style={{ color: "var(--color-text)" }}
                  data-selected={false}
                >
                  @{board}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Items"
              className="text-xs md:text-sm font-semibold px-3 py-2"
              style={{ color: "var(--color-accent)" }}
            >
              {items.slice(0, 20).map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.description}
                  className="px-4 py-3 rounded-lg text-sm md:text-base cursor-pointer flex items-center gap-3"
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
