import { Wifi, WifiOff } from "lucide-react";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";

export function ConnectionIndicator() {
  const { state } = useConnectionStatus();

  const config = {
    connected: {
      color: "var(--color-success)",
      icon: Wifi,
      title: "Connected to server",
    },
    reconnecting: {
      color: "var(--color-warning)",
      icon: Wifi,
      title: "Reconnecting to server...",
    },
    disconnected: {
      color: "var(--color-error)",
      icon: WifiOff,
      title: "Server unreachable",
    },
  }[state];

  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-1.5"
      title={config.title}
      aria-label={config.title}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: 20, height: 20 }}
      >
        <Icon size={14} style={{ color: config.color }} />
        {state === "reconnecting" && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-40"
            style={{ backgroundColor: config.color }}
          />
        )}
      </div>
      {state === "disconnected" && (
        <span
          className="hidden md:inline text-xs font-medium"
          style={{ color: config.color }}
        >
          Offline
        </span>
      )}
    </div>
  );
}
