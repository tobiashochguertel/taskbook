import { useEffect, useMemo, useRef } from "react";

export type ShortcutCategory =
  | "navigation"
  | "actions"
  | "search"
  | "views"
  | "other";

export interface KeyboardShortcut {
  key: string;
  keys: string[];
  label: string;
  category: ShortcutCategory;
  action: () => void;
}

export interface KeyboardActions {
  onToggleHelp?: () => void;
  onSearch?: () => void;
  onNewItem?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleComplete?: () => void;
  onToggleStar?: () => void;
  onSetPriority?: () => void;
  onToggleView?: () => void;
  onRefresh?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToTop?: () => void;
  onMoveToBottom?: () => void;
  onViewBoard?: () => void;
  onViewAllBoards?: () => void;
  onViewDashboard?: () => void;
}

interface UseKeyboardShortcutsOptions {
  actions: KeyboardActions;
  disabled?: boolean;
}

function noop() {}

export function useKeyboardShortcuts({
  actions,
  disabled = false,
}: UseKeyboardShortcutsOptions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      // Navigation
      {
        key: "↑",
        keys: ["ArrowUp"],
        label: "Move up",
        category: "navigation",
        action: () => actionsRef.current.onMoveUp?.(),
      },
      {
        key: "↓",
        keys: ["ArrowDown"],
        label: "Move down",
        category: "navigation",
        action: () => actionsRef.current.onMoveDown?.(),
      },
      {
        key: "j",
        keys: ["j"],
        label: "Move down",
        category: "navigation",
        action: () => actionsRef.current.onMoveDown?.(),
      },
      {
        key: "k",
        keys: ["k"],
        label: "Move up",
        category: "navigation",
        action: () => actionsRef.current.onMoveUp?.(),
      },
      {
        key: "Home",
        keys: ["Home"],
        label: "Go to top",
        category: "navigation",
        action: () => actionsRef.current.onMoveToTop?.(),
      },
      {
        key: "End",
        keys: ["End"],
        label: "Go to bottom",
        category: "navigation",
        action: () => actionsRef.current.onMoveToBottom?.(),
      },
      {
        key: "Tab",
        keys: ["Tab"],
        label: "Cycle view",
        category: "navigation",
        action: () => actionsRef.current.onToggleView?.(),
      },

      // Actions
      {
        key: "n",
        keys: ["n"],
        label: "New task",
        category: "actions",
        action: () => actionsRef.current.onNewItem?.(),
      },
      {
        key: "e",
        keys: ["e"],
        label: "Edit",
        category: "actions",
        action: () => actionsRef.current.onEdit?.(),
      },
      {
        key: "d",
        keys: ["d"],
        label: "Delete",
        category: "actions",
        action: () => actionsRef.current.onDelete?.(),
      },
      {
        key: "c",
        keys: ["c"],
        label: "Toggle complete",
        category: "actions",
        action: () => actionsRef.current.onToggleComplete?.(),
      },
      {
        key: "s",
        keys: ["s"],
        label: "Toggle star",
        category: "actions",
        action: () => actionsRef.current.onToggleStar?.(),
      },
      {
        key: "p",
        keys: ["p"],
        label: "Set priority",
        category: "actions",
        action: () => actionsRef.current.onSetPriority?.(),
      },

      // Search & Filter
      {
        key: "⌘K",
        keys: ["$mod+KeyK"],
        label: "Command palette",
        category: "search",
        action: () => actionsRef.current.onSearch?.(),
      },
      {
        key: "/",
        keys: ["/"],
        label: "Search",
        category: "search",
        action: () => actionsRef.current.onSearch?.(),
      },

      // Views
      {
        key: "1",
        keys: ["1"],
        label: "Board view",
        category: "views",
        action: () => actionsRef.current.onViewBoard?.(),
      },
      {
        key: "2",
        keys: ["2"],
        label: "All boards",
        category: "views",
        action: () => actionsRef.current.onViewAllBoards?.(),
      },
      {
        key: "3",
        keys: ["3"],
        label: "Dashboard",
        category: "views",
        action: () => actionsRef.current.onViewDashboard?.(),
      },

      // Other
      {
        key: "?",
        keys: ["Shift+/"],
        label: "Help",
        category: "other",
        action: () => actionsRef.current.onToggleHelp?.(),
      },
      {
        key: "r",
        keys: ["r"],
        label: "Refresh",
        category: "other",
        action: () => actionsRef.current.onRefresh?.(),
      },
    ],
    [],
  );

  useEffect(() => {
    if (disabled) return;

    let cleanup: (() => void) | undefined;

    import("tinykeys").then(({ tinykeys }) => {
      const bindings: Record<string, (e: KeyboardEvent) => void> = {};

      for (const shortcut of shortcuts) {
        for (const key of shortcut.keys) {
          bindings[key] = (e) => {
            // Don't intercept when typing in inputs
            const target = e.target as HTMLElement;
            if (
              target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable
            ) {
              return;
            }

            // Tab needs preventDefault to avoid focus change
            if (key === "Tab" || key === "$mod+KeyK") {
              e.preventDefault();
            }

            shortcut.action();
          };
        }
      }

      cleanup = tinykeys(window, bindings);
    });

    return () => cleanup?.();
  }, [disabled, shortcuts]);

  return { shortcuts };
}

/** Subset of shortcuts shown in the footer bar */
export function getFooterShortcuts(
  shortcuts: KeyboardShortcut[],
): KeyboardShortcut[] {
  const footerKeys = new Set(["⌘K", "?", "n", "c", "s", "d", "Tab"]);
  return shortcuts.filter((s) => footerKeys.has(s.key));
}

/** Group shortcuts by category */
export function groupByCategory(
  shortcuts: KeyboardShortcut[],
): Record<ShortcutCategory, KeyboardShortcut[]> {
  const groups: Record<ShortcutCategory, KeyboardShortcut[]> = {
    navigation: [],
    actions: [],
    search: [],
    views: [],
    other: [],
  };
  for (const s of shortcuts) {
    groups[s.category].push(s);
  }
  return groups;
}

/** Mobile-friendly subset (only essential shortcuts) */
export function getMobileShortcuts(
  shortcuts: KeyboardShortcut[],
): KeyboardShortcut[] {
  const mobileKeys = new Set(["?", "⌘K"]);
  return shortcuts.filter((s) => mobileKeys.has(s.key));
}
