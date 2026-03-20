import { useMemo } from "react";
import { groupByBoard, isTask, type StorageItem } from "../../lib/types";

interface StatsWidgetProps {
  items: StorageItem[];
}

export function StatsWidget({ items }: StatsWidgetProps) {
  const stats = useMemo(() => {
    const tasks = items.filter(isTask);
    const notes = items.filter((i) => !isTask(i));
    const completed = tasks.filter((t) => t.isComplete);
    const inProgress = tasks.filter((t) => t.inProgress);
    const pct =
      tasks.length > 0
        ? Math.round((completed.length / tasks.length) * 100)
        : 0;
    const byBoard = groupByBoard(items);
    return { tasks, notes, completed, inProgress, pct, byBoard };
  }, [items]);

  return (
    <div className="flex flex-col gap-3 text-xs h-full">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Tasks"
          value={stats.tasks.length}
          color="var(--color-accent)"
        />
        <StatCard
          label="Done"
          value={stats.completed.length}
          color="var(--color-success)"
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress.length}
          color="var(--color-warning)"
        />
        <StatCard
          label="Notes"
          value={stats.notes.length}
          color="var(--color-info)"
        />
      </div>

      {/* Progress bar */}
      <div>
        <div
          className="flex justify-between mb-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Completion</span>
          <span>{stats.pct}%</span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--color-border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${stats.pct}%`,
              backgroundColor: "var(--color-success)",
            }}
          />
        </div>
      </div>

      {/* Per-board breakdown */}
      {Object.keys(stats.byBoard).length > 1 && (
        <div className="flex flex-col gap-1 overflow-auto">
          <span
            className="font-semibold"
            style={{ color: "var(--color-text-muted)" }}
          >
            Boards
          </span>
          {Object.entries(stats.byBoard).map(([name, boardItems]) => {
            const boardTasks = boardItems.filter(isTask);
            const boardDone = boardTasks.filter((t) => t.isComplete).length;
            return (
              <div
                key={name}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded-md"
                style={{ backgroundColor: "var(--color-surface-hover)" }}
              >
                <span
                  className="truncate"
                  style={{ color: "var(--color-text)" }}
                >
                  {name}
                </span>
                <span
                  className="shrink-0 tabular-nums"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {boardDone}/{boardTasks.length}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-2"
      style={{ backgroundColor: "var(--color-surface-hover)" }}
    >
      <span className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
    </div>
  );
}
