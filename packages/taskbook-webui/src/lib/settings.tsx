import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light" | "system";
export type NavStyle = "tabs" | "burger" | "both";

export interface WebUISettings {
  theme: Theme;
  navStyle: NavStyle;
  swipeGestures: boolean;
  compactCards: boolean;
  autoCloseDrawer: boolean;
  /** Whether radial menu auto-closes after item click (default: true) */
  radialMenuAutoClose: boolean;
}

const DEFAULT_SETTINGS: WebUISettings = {
  theme: "dark",
  navStyle: "both",
  swipeGestures: true,
  compactCards: false,
  autoCloseDrawer: true,
  radialMenuAutoClose: true,
};

const STORAGE_KEY = "tb_webui_settings";

interface SettingsContextValue {
  settings: WebUISettings;
  update: (partial: Partial<WebUISettings>) => void;
  resolvedTheme: "dark" | "light";
  isMobile: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): WebUISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: WebUISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WebUISettings>(loadSettings);
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(
    getSystemTheme,
  );
  const [isMobile, setIsMobile] = useState(false);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Track viewport width for mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const resolvedTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const update = useCallback((partial: Partial<WebUISettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, update, resolvedTheme, isMobile }),
    [settings, update, resolvedTheme, isMobile],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}
