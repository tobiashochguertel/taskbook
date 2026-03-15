import { CheckSquare, ClipboardList, StickyNote } from "lucide-react";

export type MobileTab = "tasks" | "notes" | "done";

interface MobileTabsProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  counts: { tasks: number; notes: number; done: number };
}

const TABS: {
  id: MobileTab;
  label: string;
  icon: typeof ClipboardList;
}[] = [
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "done", label: "Done", icon: CheckSquare },
];

export function MobileTabs({ active, onChange, counts }: MobileTabsProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t safe-bottom"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 cursor-pointer border-none relative"
            style={{
              background: "none",
              color: isActive
                ? "var(--color-accent)"
                : "var(--color-text-muted)",
              minHeight: 56,
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <div
                className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
            )}
            <div className="relative">
              <Icon size={20} />
              {count > 0 && (
                <span
                  className="absolute -top-1.5 -right-3 text-[10px] font-bold px-1 rounded-full leading-tight"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                    color: "var(--color-bg)",
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
