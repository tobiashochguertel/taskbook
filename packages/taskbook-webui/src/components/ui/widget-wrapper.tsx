import { GripVertical, X } from "lucide-react";
import type { ReactNode } from "react";

interface WidgetWrapperProps {
  title: string;
  isEditing: boolean;
  onRemove?: () => void;
  children: ReactNode;
}

export function WidgetWrapper({
  title,
  isEditing,
  onRemove,
  children,
}: WidgetWrapperProps) {
  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header / drag handle */}
      <div
        className="widget-drag-handle flex items-center gap-2 px-3 py-2 shrink-0 select-none"
        style={{
          borderBottom: "1px solid var(--color-border)",
          cursor: isEditing ? "grab" : "default",
        }}
      >
        {isEditing && (
          <GripVertical
            size={14}
            style={{ color: "var(--color-text-muted)" }}
            className="shrink-0"
          />
        )}

        <span
          className="text-xs font-semibold truncate flex-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {title}
        </span>

        {isEditing && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 p-1 rounded-md transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-error)";
              e.currentTarget.style.backgroundColor =
                "var(--color-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label="Remove widget"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
