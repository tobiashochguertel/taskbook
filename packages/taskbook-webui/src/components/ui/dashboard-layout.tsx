import { Lock, Plus, RotateCcw, Unlock } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  type Layout,
  type LayoutItem,
  ResponsiveGridLayout,
  type ResponsiveLayouts,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import type { StorageItem } from "../../lib/types";
import type { WidgetType } from "../../lib/widgets";
import { AllBoardsWidget } from "../widgets/all-boards-widget";
import { ArchiveWidget } from "../widgets/archive-widget";
import { BoardWidget } from "../widgets/board-widget";
import { QuickAddWidget } from "../widgets/quick-add-widget";
import { StatsWidget } from "../widgets/stats-widget";
import { TimelineWidget } from "../widgets/timeline-widget";
import { WidgetCatalog } from "./widget-catalog";
import { WidgetWrapper } from "./widget-wrapper";

const BREAKPOINTS = { lg: 1200, md: 768, sm: 375 };
const COLS = { lg: 12, md: 12, sm: 12 };
const ROW_HEIGHT = 60;

interface DashboardProps {
  items: StorageItem[];
  boards: string[];
  onAddItem?: (description: string, isTask: boolean, board: string) => void;
  onToggleComplete?: (item: StorageItem) => void;
  onToggleStar?: (item: StorageItem) => void;
  onDelete?: (item: StorageItem) => void;
  onEdit?: (item: StorageItem, newDescription: string) => void;
  onToggleProgress?: (item: StorageItem) => void;
  onChangePriority?: (item: StorageItem, newPriority: number) => void;
  onMoveToBoard?: (item: StorageItem, targetBoard: string) => void;
  onUpdateTags?: (item: StorageItem, newTags: string[]) => void;
  onArchive?: (item: StorageItem) => void;
  archiveItems?: StorageItem[];
  onRestoreItem?: (item: StorageItem) => void;
}

export function DashboardLayout({
  items,
  boards,
  onAddItem,
  onToggleComplete,
  onToggleStar,
  onDelete,
  onEdit,
  onToggleProgress,
  onChangePriority,
  onMoveToBoard,
  onUpdateTags,
  onArchive,
  archiveItems,
  onRestoreItem,
}: DashboardProps) {
  const { layout, updateLayouts, addWidget, removeWidget, resetToDefault } =
    useDashboardLayout();

  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1200,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleLayoutChange = useCallback(
    (_current: Layout, allLayouts: ResponsiveLayouts) => {
      for (const [bp, bpLayout] of Object.entries(allLayouts)) {
        if (bpLayout) {
          updateLayouts(bp, [...bpLayout] as LayoutItem[]);
        }
      }
    },
    [updateLayouts],
  );

  const handleAddWidget = useCallback(
    (type: WidgetType) => {
      addWidget(type);
    },
    [addWidget],
  );

  const widgetMap = useMemo(() => {
    const map = new Map<string, (typeof layout.widgets)[number]>();
    for (const w of layout.widgets) map.set(w.id, w);
    return map;
  }, [layout.widgets]);

  function renderWidgetContent(widgetId: string) {
    const config = widgetMap.get(widgetId);
    if (!config) return null;

    switch (config.type) {
      case "board":
        return (
          <BoardWidget
            items={items}
            boardName={
              (config.props?.boardName as string) ?? boards[0] ?? "My Board"
            }
            onToggleComplete={onToggleComplete ?? (() => {})}
            onToggleStar={onToggleStar ?? (() => {})}
          />
        );
      case "all-boards":
        return (
          <AllBoardsWidget
            items={items}
            boards={boards}
            onToggleComplete={onToggleComplete ?? (() => {})}
            onToggleStar={onToggleStar ?? (() => {})}
            onDelete={onDelete ?? (() => {})}
            onEdit={onEdit ?? (() => {})}
            onToggleProgress={onToggleProgress ?? (() => {})}
            onChangePriority={onChangePriority ?? (() => {})}
            onMoveToBoard={onMoveToBoard ?? (() => {})}
            onUpdateTags={onUpdateTags ?? (() => {})}
            onArchive={onArchive ?? (() => {})}
          />
        );
      case "stats":
        return <StatsWidget items={items} />;
      case "timeline":
        return <TimelineWidget items={items} />;
      case "quick-add":
        return (
          <QuickAddWidget boards={boards} onAdd={onAddItem ?? (() => {})} />
        );
      case "archive":
        return (
          <ArchiveWidget items={archiveItems ?? []} onRestore={onRestoreItem} />
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{
            backgroundColor: isEditing
              ? "var(--color-accent)"
              : "var(--color-surface)",
            color: isEditing ? "var(--color-bg)" : "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
          aria-label={isEditing ? "Lock layout" : "Edit layout"}
        >
          {isEditing ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{isEditing ? "Editing" : "Locked"}</span>
        </button>

        {isEditing && (
          <>
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
              aria-label="Add widget"
            >
              <Plus size={14} />
              <span>Add Widget</span>
            </button>

            <button
              type="button"
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
              aria-label="Reset layout"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {mounted && (
          <ResponsiveGridLayout
            width={width}
            layouts={layout.layouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            isDraggable={isEditing}
            isResizable={isEditing}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={handleLayoutChange}
            compactor={verticalCompactor}
            margin={[12, 12]}
            containerPadding={[0, 0]}
          >
            {layout.widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetWrapper
                  title={widget.title}
                  isEditing={isEditing}
                  onRemove={() => removeWidget(widget.id)}
                >
                  {renderWidgetContent(widget.id)}
                </WidgetWrapper>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Widget catalog dialog */}
      <WidgetCatalog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onSelect={handleAddWidget}
      />
    </div>
  );
}
