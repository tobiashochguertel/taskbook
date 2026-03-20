import { Menu, MenuItem, SubMenu } from "@spaceymonk/react-radial-menu";
import {
  Archive,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  Menu as MenuIcon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  StickyNote,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../../lib/settings";
import "../../styles/radial-menu.css";

// ── Types ──────────────────────────────────────────────────────

interface RadialActionMenuProps {
  onNewTask: () => void;
  onNewNote: () => void;
  onSearch: () => void;
  onSync: () => void;
  onViewBoard: () => void;
  onViewAllBoards: () => void;
  onViewDashboard: () => void;
  onOpenArchive: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  bottomOffset?: number;
  /** Force visibility regardless of pointer type */
  visible?: boolean;
}

type ActionKey =
  | "task"
  | "note"
  | "search"
  | "sync"
  | "board"
  | "all-boards"
  | "dashboard"
  | "archive"
  | "settings"
  | "help";

// Submenu parent identifiers — NOT action keys
const SUBMENU_KEYS = new Set(["views", "more"]);

const OUTER_RADIUS = 100;

// ── Helpers ────────────────────────────────────────────────────

function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isTouch;
}

/** Clamp menu center so the full circle fits within viewport */
function clampMenuCenter(
  rawX: number,
  rawY: number,
  radius: number,
): { x: number; y: number } {
  const margin = 8;
  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.min(Math.max(radius + margin, rawX), w - radius - margin),
    y: Math.min(Math.max(radius + margin, rawY), h - radius - margin),
  };
}

const ICON_SIZE = 18;

function ItemContent({
  icon: Icon,
  label,
}: {
  icon: React.FC<{ size?: number }>;
  label: string;
}) {
  return (
    <>
      <Icon size={ICON_SIZE} />
      <span>{label}</span>
    </>
  );
}

// ── Component ──────────────────────────────────────────────────

export function RadialActionMenu({
  onNewTask,
  onNewNote,
  onSearch,
  onSync,
  onViewBoard,
  onViewAllBoards,
  onViewDashboard,
  onOpenArchive,
  onOpenSettings,
  onOpenHelp,
  bottomOffset = 0,
  visible,
}: RadialActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clickedItem, setClickedItem] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isTouch = useTouchDevice();
  const { settings, resolvedTheme } = useSettings();

  const actionMap = useMemo<Record<ActionKey, () => void>>(
    () => ({
      task: onNewTask,
      note: onNewNote,
      search: onSearch,
      sync: onSync,
      board: onViewBoard,
      "all-boards": onViewAllBoards,
      dashboard: onViewDashboard,
      archive: onOpenArchive,
      settings: onOpenSettings,
      help: onOpenHelp,
    }),
    [
      onNewTask,
      onNewNote,
      onSearch,
      onSync,
      onViewBoard,
      onViewAllBoards,
      onViewDashboard,
      onOpenArchive,
      onOpenSettings,
      onOpenHelp,
    ],
  );

  const handleItemClick = useCallback(
    (_event: React.MouseEvent, _index: number, data?: string) => {
      if (!data) return;

      // SubMenu parent items just navigate — don't close
      if (SUBMENU_KEYS.has(data)) return;

      // Flash visual feedback
      setClickedItem(data);
      setTimeout(() => setClickedItem(null), 200);

      // Execute the action
      const action = actionMap[data as ActionKey];
      if (action) {
        navigator.vibrate?.(5);
        action();
      }

      // Auto-close unless disabled in settings
      if (settings.radialMenuAutoClose !== false) {
        setTimeout(() => setIsOpen(false), 120);
      }
    },
    [actionMap, settings.radialMenuAutoClose],
  );

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) navigator.vibrate?.(10);
      return next;
    });
  }, []);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const shouldRender = visible ?? isTouch;
  if (!shouldRender) return null;

  // Compute menu center — button is bottom-right, clamp within viewport
  const btnCenterX =
    typeof window !== "undefined" ? window.innerWidth - 44 : 331;
  const btnCenterY =
    typeof window !== "undefined"
      ? window.innerHeight - bottomOffset - 44
      : 700;
  const { x: menuCenterX, y: menuCenterY } = clampMenuCenter(
    btnCenterX,
    btnCenterY,
    OUTER_RADIUS,
  );

  const triggerBottom = `calc(${bottomOffset}px + max(1rem, env(safe-area-inset-bottom, 1rem)))`;
  const triggerRight = "max(1rem, env(safe-area-inset-right, 1rem))";

  return (
    <>
      {/* Backdrop – closes menu on outside tap */}
      {isOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop needs click to dismiss
        <div
          data-testid="radial-menu-backdrop"
          className="radial-menu-backdrop"
          onClick={closeMenu}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeMenu();
          }}
        />
      )}

      {/* Radial menu (SVG overlay) */}
      <div
        data-testid="radial-menu"
        className={clickedItem ? "radial-menu-item-flash" : ""}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 41,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <Menu
          centerX={menuCenterX}
          centerY={menuCenterY}
          innerRadius={35}
          outerRadius={OUTER_RADIUS}
          show={isOpen}
          animation={["fade", "scale"]}
          animationTimeout={150}
          animateSubMenuChange
          theme={resolvedTheme}
        >
          <MenuItem onItemClick={handleItemClick} data="task">
            <ItemContent icon={Plus} label="Task" />
          </MenuItem>
          <MenuItem onItemClick={handleItemClick} data="note">
            <ItemContent icon={StickyNote} label="Note" />
          </MenuItem>
          <MenuItem onItemClick={handleItemClick} data="search">
            <ItemContent icon={Search} label="Search" />
          </MenuItem>
          <MenuItem onItemClick={handleItemClick} data="sync">
            <ItemContent icon={RefreshCw} label="Sync" />
          </MenuItem>
          <SubMenu
            itemView={<ItemContent icon={LayoutList} label="Views" />}
            displayPosition="bottom"
            data="views"
            onItemClick={handleItemClick}
          >
            <MenuItem onItemClick={handleItemClick} data="board">
              <ItemContent icon={LayoutList} label="Board" />
            </MenuItem>
            <MenuItem onItemClick={handleItemClick} data="all-boards">
              <ItemContent icon={LayoutGrid} label="All" />
            </MenuItem>
            <MenuItem onItemClick={handleItemClick} data="dashboard">
              <ItemContent icon={LayoutDashboard} label="Dash" />
            </MenuItem>
          </SubMenu>
          <SubMenu
            itemView={<ItemContent icon={Settings} label="More" />}
            displayPosition="bottom"
            data="more"
            onItemClick={handleItemClick}
          >
            <MenuItem onItemClick={handleItemClick} data="archive">
              <ItemContent icon={Archive} label="Archive" />
            </MenuItem>
            <MenuItem onItemClick={handleItemClick} data="settings">
              <ItemContent icon={Settings} label="Settings" />
            </MenuItem>
            <MenuItem onItemClick={handleItemClick} data="help">
              <ItemContent icon={HelpCircle} label="Help" />
            </MenuItem>
          </SubMenu>
        </Menu>
      </div>

      {/* Floating trigger button */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg cursor-pointer border-none"
        style={{
          width: 56,
          height: 56,
          right: triggerRight,
          bottom: triggerBottom,
          backgroundColor: "var(--color-accent)",
          color: "var(--color-bg)",
        }}
        whileTap={{ scale: 0.9 }}
        aria-label={isOpen ? "Close action menu" : "Open action menu"}
        aria-expanded={isOpen}
        data-testid="radial-menu-trigger"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex" }}
            >
              <X size={24} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex" }}
            >
              <MenuIcon size={24} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
