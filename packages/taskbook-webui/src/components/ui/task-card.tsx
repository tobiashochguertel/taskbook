import { CheckCircle2, Circle, Star } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { isTask, type StorageItem } from "../../lib/types";
import { useSettings } from "../../lib/settings";

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
  const { settings } = useSettings();
  const task = isTask(item);
  const complete = task && item.isComplete;

  // Swipe gesture state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
    setSwiped(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!settings.swipeGestures || !task) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      // Only horizontal swipes
      if (dy > 30 && !swiping.current) return;
      if (dx > 10) {
        swiping.current = true;
        setSwipeX(Math.min(dx, 120));
      }
    },
    [settings.swipeGestures, task],
  );

  const handleTouchEnd = useCallback(() => {
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

  const py = settings.compactCards ? "py-1.5" : "py-3";

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
              color: swipeX > 80 ? "var(--color-success)" : "var(--color-text-muted)",
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
        className={`flex items-start gap-3 px-3 ${py} transition-colors group cursor-default relative`}
        style={{
          backgroundColor: "var(--color-surface)",
          transform: `translateX(${swipeX}px)`,
          transition: swiping.current ? "none" : "transform 0.2s ease-out",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface)")
        }
      >
        {/* Checkbox / bullet — 44px touch target */}
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
          <p
            className={`text-sm ${complete ? "line-through" : ""}`}
            style={{
              color: complete ? "var(--color-text-muted)" : "var(--color-text)",
            }}
          >
            {item.description}
          </p>
          {item.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
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

        {/* Priority & star — always visible on touch, hover on desktop */}
        <div className="flex items-center gap-1 py-2">
          {task && item.priority > 0 && (
            <span className="text-xs" style={{ color: "var(--color-warning)" }}>
              {"★".repeat(item.priority)}
            </span>
          )}
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
        </div>
      </div>
    </div>
  );
}

