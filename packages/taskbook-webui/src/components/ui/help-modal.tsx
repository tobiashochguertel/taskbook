import { Keyboard, X } from "lucide-react";
import { useEffect } from "react";
import {
  groupByCategory,
  type KeyboardShortcut,
  type ShortcutCategory,
} from "../../hooks/useKeyboardShortcuts";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  actions: "Actions",
  search: "Search & Filter",
  views: "Views",
  other: "Other",
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  "navigation",
  "actions",
  "search",
  "views",
  "other",
];

export function HelpModal({ open, onClose, shortcuts }: HelpModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = groupByCategory(shortcuts);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "var(--color-backdrop)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 25px 60px -12px var(--color-dialog-shadow)",
          maxHeight: "80vh",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Keyboard size={18} style={{ color: "var(--color-accent)" }} />
            <h2
              className="text-sm md:text-base font-bold"
              style={{ color: "var(--color-text)" }}
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center cursor-pointer border-none rounded-md"
            style={{
              color: "var(--color-text-muted)",
              background: "none",
              width: 44,
              height: 44,
            }}
            aria-label="Close help"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-6 py-5 space-y-5 overflow-y-auto"
          style={{ maxHeight: "calc(80vh - 64px)" }}
        >
          {CATEGORY_ORDER.map((category) => {
            const items = grouped[category];
            if (items.length === 0) return null;
            return (
              <section key={category}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {CATEGORY_LABELS[category]}
                </h3>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {items.map((shortcut, i) => (
                    <div
                      key={shortcut.key + shortcut.label}
                      className="flex items-center justify-between px-4 py-2"
                      style={{
                        borderTop:
                          i > 0 ? "1px solid var(--color-border)" : undefined,
                      }}
                    >
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text)" }}
                      >
                        {shortcut.label}
                      </span>
                      <kbd
                        className="inline-flex items-center justify-center rounded px-2 font-bold"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                          fontSize: 11,
                          minWidth: 24,
                          height: 24,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Escape hint at bottom */}
          <p
            className="text-center text-xs pt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Press{" "}
            <kbd
              className="inline-flex items-center justify-center rounded px-1.5 mx-0.5 font-bold"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                fontSize: 10,
                height: 18,
                fontFamily: "var(--font-mono)",
              }}
            >
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  );
}
