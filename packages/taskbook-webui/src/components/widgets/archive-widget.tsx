import { ArchiveRestore } from "lucide-react";
import type { StorageItem } from "../../lib/types";
import { TaskCard } from "../ui/task-card";

interface ArchiveWidgetProps {
  items: StorageItem[];
  onRestore?: (item: StorageItem) => void;
}

export function ArchiveWidget({ items, onRestore }: ArchiveWidgetProps) {
  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        No archived items
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full px-2 py-1 space-y-1">
      {items.map((item) => (
        <div key={item._id} className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <TaskCard
              item={item}
              onToggleComplete={() => {}}
              onToggleStar={() => {}}
              compact
            />
          </div>
          {onRestore && (
            <button
              type="button"
              onClick={() => onRestore(item)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer border-none"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "white",
              }}
              title="Restore"
            >
              <ArchiveRestore size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
