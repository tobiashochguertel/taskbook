import { useCallback, useEffect, useState } from "react";
import type { LayoutItem } from "react-grid-layout";
import {
  createLayoutItemForWidget,
  createTuiLayout,
  createWidgetConfig,
  type DashboardLayout,
  WIDGET_CATALOG,
  type WidgetType,
} from "../lib/widgets";

const STORAGE_KEY = "tb_dashboard_layout";

function loadLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardLayout;
      if (parsed.widgets?.length && parsed.layouts) return parsed;
    }
  } catch {
    /* corrupt data — fall through */
  }
  return createTuiLayout();
}

function saveLayout(layout: DashboardLayout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const updateLayouts = useCallback(
    (breakpoint: string, newLayout: LayoutItem[]) => {
      setLayout((prev) => ({
        ...prev,
        layouts: {
          ...prev.layouts,
          [breakpoint]: newLayout,
        },
      }));
    },
    [],
  );

  const addWidget = useCallback(
    (type: WidgetType, props?: Record<string, unknown>) => {
      const catalog = WIDGET_CATALOG[type];
      const widget = createWidgetConfig(type, {
        title: catalog.name,
        props,
      });

      setLayout((prev) => {
        const lgItem = createLayoutItemForWidget(
          widget.id,
          type,
          prev.layouts.lg,
        );
        const mdItem = createLayoutItemForWidget(
          widget.id,
          type,
          prev.layouts.md,
        );
        const smItem = { ...mdItem, w: 12 };

        return {
          ...prev,
          widgets: [...prev.widgets, widget],
          layouts: {
            lg: [...prev.layouts.lg, lgItem],
            md: [...prev.layouts.md, mdItem],
            sm: [...prev.layouts.sm, smItem],
          },
        };
      });
    },
    [],
  );

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
      layouts: {
        lg: prev.layouts.lg.filter((l) => l.i !== widgetId),
        md: prev.layouts.md.filter((l) => l.i !== widgetId),
        sm: prev.layouts.sm.filter((l) => l.i !== widgetId),
      },
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    const def = createTuiLayout();
    setLayout(def);
  }, []);

  const applyPreset = useCallback((preset: DashboardLayout) => {
    setLayout(preset);
  }, []);

  return {
    layout,
    updateLayouts,
    addWidget,
    removeWidget,
    resetToDefault,
    applyPreset,
  };
}
