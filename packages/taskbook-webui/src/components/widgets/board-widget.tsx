import { CheckSquare, StickyNote } from "lucide-react";
import type { StorageItem } from "../../lib/types";
import { isTask } from "../../lib/types";
import { TaskCard } from "../ui/task-card";

interface BoardWidgetProps {
  items: StorageItem[];
  boardName: string;
  onToggleComplete: (item: StorageItem) => void;
  onToggleStar: (item: StorageItem) => void;
}

export function BoardWidget({
  items,
  boardName,
  onToggleComplete,
  onToggleStar,
}: BoardWidgetProps) {
  const boardItems = items.filter((i) => i.boards.includes(boardName));
  const tasks = boardItems.filter((i) => isTask(i) && !i.isComplete);
  const notes = boardItems.filter((i) => !isTask(i));
  const done = boardItems.filter((i) => isTask(i) && i.isComplete);

  if (boardItems.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        No items in @{boardName}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full px-2 py-1 space-y-1">
      {tasks.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1"
            style={{ color: "var(--color-warning)" }}
          >
            <CheckSquare size={10} /> Tasks ({tasks.length})
          </div>
          {tasks.map((item) => (
            <TaskCard
              key={item._id}
              item={item}
              onToggleComplete={() => onToggleComplete(item)}
              onToggleStar={() => onToggleStar(item)}
              compact
            />
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1"
            style={{ color: "var(--color-info)" }}
          >
            <StickyNote size={10} /> Notes ({notes.length})
          </div>
          {notes.map((item) => (
            <TaskCard
              key={item._id}
              item={item}
              onToggleComplete={() => {}}
              onToggleStar={() => onToggleStar(item)}
              compact
            />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1 text-[10px] font-bold uppercase mb-1"
            style={{ color: "var(--color-success)" }}
          >
            <CheckSquare size={10} /> Done ({done.length})
          </div>
          {done.map((item) => (
            <TaskCard
              key={item._id}
              item={item}
              onToggleComplete={() => onToggleComplete(item)}
              onToggleStar={() => onToggleStar(item)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
