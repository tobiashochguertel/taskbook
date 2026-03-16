import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";
import type { SyncState } from "../../hooks/useItems";

interface SyncIndicatorProps {
  syncState: SyncState;
  lastSyncTime: Date | null;
  syncError: string | null;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function ConnectionIndicator({
  syncState,
  lastSyncTime,
  syncError,
}: SyncIndicatorProps) {
  const { state } = useConnectionStatus();

  // Connection takes precedence if disconnected
  if (state === "disconnected") {
    return (
      <div
        className="flex items-center gap-1.5"
        title="Server unreachable"
        aria-label="Server unreachable"
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: 20, height: 20 }}
        >
          <WifiOff size={14} style={{ color: "var(--color-error)" }} />
        </div>
        <span
          className="hidden md:inline text-xs font-medium"
          style={{ color: "var(--color-error)" }}
        >
          Offline
        </span>
      </div>
    );
  }

  const syncConfig = {
    idle: {
      color: "var(--color-text-muted)",
      title: "Waiting for sync",
    },
    syncing: {
      color: "var(--color-warning)",
      title: "Syncing...",
    },
    success: {
      color: "var(--color-success)",
      title: lastSyncTime ? `Synced ${formatTimeAgo(lastSyncTime)}` : "Synced",
    },
    error: {
      color: "var(--color-error)",
      title: syncError ? `Sync error: ${syncError}` : "Sync failed",
    },
  }[syncState];

  return (
    <div
      className="flex items-center gap-1.5"
      title={syncConfig.title}
      aria-label={syncConfig.title}
    >
      {/* Connection dot */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 20, height: 20 }}
      >
        {state === "reconnecting" ? (
          <>
            <Wifi size={14} style={{ color: "var(--color-warning)" }} />
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-40"
              style={{ backgroundColor: "var(--color-warning)" }}
            />
          </>
        ) : (
          <Wifi size={14} style={{ color: "var(--color-success)" }} />
        )}
      </div>

      {/* Sync status traffic light */}
      <div className="flex items-center gap-1">
        {syncState === "syncing" ? (
          <RefreshCw
            size={12}
            className="animate-spin"
            style={{ color: syncConfig.color }}
          />
        ) : (
          <div
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor: syncConfig.color,
              boxShadow:
                syncState === "error"
                  ? `0 0 6px ${syncConfig.color}`
                  : undefined,
            }}
          />
        )}
        {lastSyncTime && syncState === "success" && (
          <span
            className="hidden lg:inline text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {formatTimeAgo(lastSyncTime)}
          </span>
        )}
        {syncState === "error" && (
          <span
            className="hidden md:inline text-xs font-medium"
            style={{ color: "var(--color-error)" }}
          >
            Error
          </span>
        )}
      </div>
    </div>
  );
}
