import {
  type KeyboardShortcut,
  getFooterShortcuts,
  getMobileShortcuts,
} from "../../hooks/useKeyboardShortcuts";
import { useSettings } from "../../lib/settings";

export type ViewMode = "board" | "all-boards" | "dashboard";

interface FooterBarProps {
  shortcuts: KeyboardShortcut[];
  viewMode: ViewMode;
  onKeyAction?: (shortcut: KeyboardShortcut) => void;
  stats?: { tasks: number; done: number; notes: number };
}

const VIEW_LABELS: Record<ViewMode, string> = {
  board: "Board",
  "all-boards": "All Boards",
  dashboard: "Dashboard",
};

export function FooterBar({
  shortcuts,
  viewMode,
  onKeyAction,
  stats,
}: FooterBarProps) {
  const { isMobile } = useSettings();

  const visibleShortcuts = isMobile
    ? getMobileShortcuts(shortcuts)
    : getFooterShortcuts(shortcuts);

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-20 flex items-center border-t safe-bottom"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
        height: 36,
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Shortcut hints */}
      <div className="flex items-center overflow-x-auto shrink-0">
        {visibleShortcuts.map((shortcut) => (
          <button
            key={shortcut.key}
            type="button"
            onClick={() => {
              shortcut.action();
              onKeyAction?.(shortcut);
            }}
            className="flex items-center gap-1.5 px-2.5 h-full whitespace-nowrap cursor-pointer border-none border-r"
            style={{
              background: "none",
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
              fontSize: 11,
              lineHeight: "36px",
            }}
          >
            <kbd
              className="inline-flex items-center justify-center rounded px-1.5 font-bold"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                fontSize: 10,
                minWidth: 20,
                height: 20,
                fontFamily: "var(--font-mono)",
              }}
            >
              {shortcut.key}
            </kbd>
            <span>{shortcut.label}</span>
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode indicator */}
      {!isMobile && (
        <div
          className="flex items-center px-3 text-xs whitespace-nowrap"
          style={{ color: "var(--color-text-muted)", fontSize: 11 }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          {VIEW_LABELS[viewMode]}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div
          className="flex items-center gap-1 px-3 whitespace-nowrap border-l"
          style={{
            color: "var(--color-text-muted)",
            borderColor: "var(--color-border)",
            fontSize: 11,
          }}
        >
          <span>{stats.tasks} tasks</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{stats.done} done</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{stats.notes} notes</span>
        </div>
      )}
    </footer>
  );
}
