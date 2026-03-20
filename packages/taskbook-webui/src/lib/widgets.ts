import type { LayoutItem } from "react-grid-layout";

export type WidgetType =
  | "board"
  | "all-boards"
  | "stats"
  | "timeline"
  | "quick-add"
  | "archive";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  props?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  layouts: {
    lg: LayoutItem[];
    md: LayoutItem[];
    sm: LayoutItem[];
  };
  isDefault?: boolean;
}

export const WIDGET_CATALOG: Record<
  WidgetType,
  {
    name: string;
    description: string;
    icon: string;
    defaultSize: { w: number; h: number };
    minSize: { w: number; h: number };
  }
> = {
  board: {
    name: "Board",
    description: "Single board with tasks, notes, and done columns",
    icon: "LayoutDashboard",
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 4, h: 4 },
  },
  "all-boards": {
    name: "All Boards",
    description: "All boards stacked vertically (TUI view)",
    icon: "Layers",
    defaultSize: { w: 12, h: 10 },
    minSize: { w: 6, h: 4 },
  },
  stats: {
    name: "Statistics",
    description: "Task completion statistics",
    icon: "BarChart3",
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
  },
  timeline: {
    name: "Timeline",
    description: "Recent activity feed",
    icon: "Clock",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
  },
  "quick-add": {
    name: "Quick Add",
    description: "Quickly create tasks and notes",
    icon: "Plus",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
  },
  archive: {
    name: "Archive",
    description: "View archived items",
    icon: "Archive",
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 3 },
  },
};

let _widgetCounter = 0;

function nextWidgetId(): string {
  _widgetCounter += 1;
  return `w-${Date.now()}-${_widgetCounter}`;
}

export function createWidgetConfig(
  type: WidgetType,
  overrides?: Partial<WidgetConfig>,
): WidgetConfig {
  const catalog = WIDGET_CATALOG[type];
  return {
    id: nextWidgetId(),
    type,
    title: catalog.name,
    ...overrides,
  };
}

export function createDefaultLayout(): DashboardLayout {
  const allBoards = createWidgetConfig("all-boards", {
    id: "default-all-boards",
  });
  const stats = createWidgetConfig("stats", { id: "default-stats" });
  const quickAdd = createWidgetConfig("quick-add", { id: "default-quick-add" });
  const timeline = createWidgetConfig("timeline", { id: "default-timeline" });

  return {
    id: "default",
    name: "Default",
    widgets: [allBoards, stats, quickAdd, timeline],
    layouts: {
      lg: [
        { i: allBoards.id, x: 0, y: 0, w: 8, h: 10, minW: 6, minH: 4 },
        { i: stats.id, x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
        { i: quickAdd.id, x: 8, y: 3, w: 4, h: 2, minW: 3, minH: 2 },
        { i: timeline.id, x: 8, y: 5, w: 4, h: 5, minW: 3, minH: 3 },
      ],
      md: [
        { i: allBoards.id, x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 4 },
        { i: stats.id, x: 0, y: 10, w: 6, h: 3, minW: 3, minH: 2 },
        { i: quickAdd.id, x: 6, y: 10, w: 6, h: 2, minW: 3, minH: 2 },
        { i: timeline.id, x: 0, y: 13, w: 12, h: 5, minW: 3, minH: 3 },
      ],
      sm: [
        { i: allBoards.id, x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 4 },
        { i: stats.id, x: 0, y: 8, w: 12, h: 3, minW: 3, minH: 2 },
        { i: quickAdd.id, x: 0, y: 11, w: 12, h: 2, minW: 3, minH: 2 },
        { i: timeline.id, x: 0, y: 13, w: 12, h: 5, minW: 3, minH: 3 },
      ],
    },
    isDefault: true,
  };
}

export function createTuiLayout(): DashboardLayout {
  const allBoards = createWidgetConfig("all-boards", {
    id: "tui-all-boards",
    title: "All Boards",
  });

  return {
    id: "tui",
    name: "TUI View",
    widgets: [allBoards],
    layouts: {
      lg: [{ i: allBoards.id, x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 4 }],
      md: [{ i: allBoards.id, x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 4 }],
      sm: [{ i: allBoards.id, x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 4 }],
    },
    isDefault: false,
  };
}

export function createLayoutItemForWidget(
  widgetId: string,
  type: WidgetType,
  existingLayouts: LayoutItem[],
): LayoutItem {
  const catalog = WIDGET_CATALOG[type];
  const { w, h } = catalog.defaultSize;
  const { w: minW, h: minH } = catalog.minSize;

  // Place below existing widgets
  let maxY = 0;
  for (const item of existingLayouts) {
    const bottom = item.y + item.h;
    if (bottom > maxY) maxY = bottom;
  }

  return { i: widgetId, x: 0, y: maxY, w, h, minW, minH };
}
