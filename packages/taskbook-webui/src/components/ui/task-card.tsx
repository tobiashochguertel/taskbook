import { CheckCircle2, Circle, Star } from "lucide-react";
import { isTask, type StorageItem } from "../../lib/types";

interface TaskCardProps {
  item: StorageItem;
  onToggleComplete: () => void;
  onToggleStar: () => void;
}

export function TaskCard({
  item,
  onToggleComplete,
  onToggleStar,
}: TaskCardProps) {
  const task = isTask(item);
  const complete = task && item.isComplete;

  return (
    <div
      className="flex items-start gap-3 px-3 py-2 rounded-md transition-colors group cursor-default"
      style={{ backgroundColor: "var(--color-surface)" }}
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
          className="mt-0.5 cursor-pointer border-none p-0"
          style={{
            color: complete
              ? "var(--color-success)"
              : "var(--color-text-muted)",
            background: "none",
          }}
        >
          {complete ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>
      ) : (
        <span className="mt-0.5" style={{ color: "var(--color-info)" }}>
          •
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${complete ? "line-through" : ""}`}
          style={{
            color: complete ? "var(--color-text-muted)" : "var(--color-text)",
          }}
        >
          {item.description}
        </p>
        {item.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-accent)",
                }}
              >
                +{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Priority & star */}
      <div className="flex items-center gap-1">
        {task && item.priority > 0 && (
          <span className="text-xs" style={{ color: "var(--color-warning)" }}>
            {"★".repeat(item.priority)}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleStar}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none p-0"
          style={{
            color: item.isStarred
              ? "var(--color-warning)"
              : "var(--color-text-muted)",
            background: "none",
          }}
        >
          <Star size={14} fill={item.isStarred ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
