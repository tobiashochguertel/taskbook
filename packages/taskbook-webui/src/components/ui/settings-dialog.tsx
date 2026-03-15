import { Monitor, Moon, Sun, X } from "lucide-react";
import { useSettings, type NavStyle, type Theme } from "../../lib/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

const NAV_STYLES: { value: NavStyle; label: string; desc: string }[] = [
  { value: "both", label: "Both", desc: "Tab bar + burger menu" },
  { value: "tabs", label: "Tabs only", desc: "Bottom tab bar" },
  { value: "burger", label: "Menu only", desc: "Burger menu" },
];

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, update } = useSettings();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: "var(--color-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--color-text)" }}
          >
            Settings
          </h2>
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
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Theme */}
          <section>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Theme
            </label>
            <div className="flex gap-2">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ theme: value })}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg cursor-pointer border-2 transition-colors"
                  style={{
                    backgroundColor:
                      settings.theme === value
                        ? "var(--color-surface-hover)"
                        : "var(--color-bg)",
                    borderColor:
                      settings.theme === value
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    color:
                      settings.theme === value
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)",
                    minHeight: 44,
                  }}
                >
                  <Icon size={18} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Navigation style */}
          <section>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Navigation
            </label>
            <div className="space-y-2">
              {NAV_STYLES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update({ navStyle: value })}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg cursor-pointer border-2 text-left transition-colors"
                  style={{
                    backgroundColor:
                      settings.navStyle === value
                        ? "var(--color-surface-hover)"
                        : "var(--color-bg)",
                    borderColor:
                      settings.navStyle === value
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    color: "var(--color-text)",
                    minHeight: 44,
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {desc}
                    </div>
                  </div>
                  {settings.navStyle === value && (
                    <span style={{ color: "var(--color-accent)" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Toggles */}
          <section className="space-y-3">
            <ToggleRow
              label="Swipe gestures"
              description="Swipe right to complete tasks"
              checked={settings.swipeGestures}
              onChange={(v) => update({ swipeGestures: v })}
            />
            <ToggleRow
              label="Compact cards"
              description="Smaller task cards"
              checked={settings.compactCards}
              onChange={(v) => update({ compactCards: v })}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full px-4 py-3 rounded-lg cursor-pointer border-none text-left"
      style={{
        backgroundColor: "var(--color-bg)",
        minHeight: 44,
      }}
    >
      <div>
        <div className="text-sm" style={{ color: "var(--color-text)" }}>
          {label}
        </div>
        <div
          className="text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {description}
        </div>
      </div>
      <div
        className="w-11 h-6 rounded-full relative transition-colors"
        style={{
          backgroundColor: checked
            ? "var(--color-accent)"
            : "var(--color-border)",
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
          style={{
            backgroundColor: "white",
            transform: checked ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </div>
    </button>
  );
}
