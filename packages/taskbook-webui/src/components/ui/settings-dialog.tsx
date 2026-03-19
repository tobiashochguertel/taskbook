import { Monitor, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { type NavStyle, type Theme, useSettings } from "../../lib/settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  token?: string;
  encryptionKey?: string;
  onKeyImport?: (key: string) => void;
  onKeyReset?: () => void;
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

type SettingsTab = "general" | "security";

export function SettingsDialog({
  open,
  onClose,
  token: _token,
  encryptionKey,
  onKeyImport,
  onKeyReset,
}: SettingsDialogProps) {
  const { settings, update, isMobile } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  if (!open) return null;

  const generalSection = (
    <>
      {/* Theme */}
      <section>
        <label
          className="block text-xs md:text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          Theme
        </label>
        <div className="flex gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
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
          className="block text-xs md:text-sm font-semibold uppercase tracking-wider mb-3"
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
        <ToggleRow
          label="Auto-close sidebar"
          description="Close sidebar after selecting a board or action"
          checked={settings.autoCloseDrawer}
          onChange={(v) => update({ autoCloseDrawer: v })}
        />
      </section>
    </>
  );

  const securitySection = (
    <section>
      <label
        className="block text-xs md:text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        Encryption Key
      </label>
      <div className="space-y-3">
        {encryptionKey ? (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 p-2 rounded text-xs font-mono truncate"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text-muted)",
              }}
            >
              {showKey ? encryptionKey : "••••••••••••••••••••••••"}
            </div>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 rounded text-xs cursor-pointer border-none"
              style={{
                backgroundColor: "var(--color-surface-hover)",
                color: "var(--color-text)",
              }}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() =>
                encryptionKey && navigator.clipboard.writeText(encryptionKey)
              }
              className="px-3 py-2 rounded text-xs cursor-pointer border-none"
              style={{
                backgroundColor: "var(--color-surface-hover)",
                color: "var(--color-text)",
              }}
            >
              Copy
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No encryption key set. Import one to access encrypted data.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            className="px-3 py-2 rounded text-xs cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "white",
            }}
          >
            Import Key
          </button>
          {encryptionKey && (
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="px-3 py-2 rounded text-xs cursor-pointer border-none"
              style={{
                backgroundColor: "var(--color-error)",
                color: "white",
              }}
            >
              Reset Key
            </button>
          )}
        </div>
        {showImport && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Paste encryption key..."
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              className="w-full p-2 rounded text-xs font-mono border-none outline-none"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            />
            <button
              type="button"
              disabled={!importKey}
              onClick={() => {
                onKeyImport?.(importKey);
                setShowImport(false);
                setImportKey("");
              }}
              className="px-3 py-2 rounded text-xs cursor-pointer border-none"
              style={{
                backgroundColor: importKey
                  ? "var(--color-success)"
                  : "var(--color-surface-hover)",
                color: "white",
              }}
            >
              Save Key
            </button>
          </div>
        )}
        {showReset && (
          <div
            className="p-3 rounded"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-error)",
            }}
          >
            <p className="text-xs mb-2" style={{ color: "var(--color-error)" }}>
              ⚠️ This will delete all your encrypted data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="px-3 py-2 rounded text-xs cursor-pointer border-none"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  color: "var(--color-text)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onKeyReset?.();
                  setShowReset(false);
                }}
                className="px-3 py-2 rounded text-xs cursor-pointer border-none"
                style={{
                  backgroundColor: "var(--color-error)",
                  color: "white",
                }}
              >
                Reset Key & Delete Data
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-backdrop)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 25px 60px -12px var(--color-dialog-shadow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            className="text-sm md:text-base font-bold"
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

        {isMobile ? (
          /* ── Mobile: tabbed layout ── */
          <>
            <div
              className="flex border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              {(["general", "security"] as SettingsTab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer border-none relative"
                    style={{
                      background: "none",
                      color:
                        activeTab === tab
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div
                        className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                        style={{ backgroundColor: "var(--color-accent)" }}
                      />
                    )}
                  </button>
                ),
              )}
            </div>
            <div className="px-6 py-5 space-y-6">
              {activeTab === "general" && generalSection}
              {activeTab === "security" && securitySection}
            </div>
          </>
        ) : (
          /* ── Desktop: scrollable panel with all sections ── */
          <div
            className="px-6 py-5 space-y-6 overflow-y-auto"
            style={{ maxHeight: "80vh" }}
          >
            {generalSection}
            {securitySection}
          </div>
        )}
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
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
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
