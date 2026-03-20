import {
  Archive,
  BarChart3,
  Clock,
  Layers,
  LayoutDashboard,
  Plus,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { WIDGET_CATALOG, type WidgetType } from "../../lib/widgets";

const ICON_MAP: Record<string, ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={20} />,
  Layers: <Layers size={20} />,
  BarChart3: <BarChart3 size={20} />,
  Clock: <Clock size={20} />,
  Plus: <Plus size={20} />,
  Archive: <Archive size={20} />,
};

interface WidgetCatalogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: WidgetType) => void;
}

export function WidgetCatalog({ open, onClose, onSelect }: WidgetCatalogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const entries = Object.entries(WIDGET_CATALOG) as [
    WidgetType,
    (typeof WIDGET_CATALOG)[WidgetType],
  ][];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      onKeyDown={() => {}}
      role="dialog"
      aria-modal="true"
      aria-label="Add widget"
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 24px 48px var(--color-dialog-shadow)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            Add Widget
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Widget list */}
        <div className="p-2 max-h-80 overflow-auto">
          {entries.map(([type, catalog]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              style={{ color: "var(--color-text)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span
                className="shrink-0 p-2 rounded-lg"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  color: "var(--color-accent)",
                }}
              >
                {ICON_MAP[catalog.icon] ?? <LayoutDashboard size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{catalog.name}</p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {catalog.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
