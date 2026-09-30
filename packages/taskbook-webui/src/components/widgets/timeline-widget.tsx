import { useMemo } from "react";
import { isTask, type StorageItem } from "../../lib/types";

interface TimelineWidgetProps {
  items: StorageItem[];
}

const MAX_ITEMS = 20;

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TimelineWidget({ items }: TimelineWidgetProps) {
  const sorted = useMemo(
    () =>
      [...items]
        .sort((a, b) => b._timestamp - a._timestamp)
        .slice(0, MAX_ITEMS),
    [items],
  );

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        No recent activity
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-xs h-full overflow-auto">
      {sorted.map((item) => (
        <TimelineEntry key={item._id} item={item} />
      ))}
    </div>
  );
}

function TimelineEntry({ item }: { item: StorageItem }) {
  const task = isTask(item);

  let statusIcon: string;
  let statusColor: string;
  if (!task) {
    statusIcon = "●";
    statusColor = "var(--color-info)";
  } else if (item.isComplete) {
    statusIcon = "✓";
    statusColor = "var(--color-success)";
  } else if (item.inProgress) {
    statusIcon = "◐";
    statusColor = "var(--color-warning)";
  } else {
    statusIcon = "○";
    statusColor = "var(--color-text-muted)";
  }

  return (
    <div
      className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
      style={{ backgroundColor: "var(--color-surface-hover)" }}
    >
      {/* Status icon */}
      <span className="shrink-0 mt-0.5" style={{ color: statusColor }}>
        {statusIcon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ color: "var(--color-text)" }}>
          {item.description}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span style={{ color: "var(--color-text-muted)" }}>
            {relativeTime(item._timestamp)}
          </span>
          {item.boards.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={{
                backgroundColor: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              {item.boards[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
