import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";
import type { SyncState } from "../../hooks/useItems";

interface SyncStatusButtonProps {
  syncState: SyncState;
  lastSyncTime: Date | null;
  syncError: string | null;
  isUpdating: boolean;
  onRefresh: () => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

type StatusColor = "success" | "warning" | "error" | "muted";

function getStatusColor(
  connectionState: string,
  syncState: SyncState,
): StatusColor {
  if (connectionState === "disconnected") return "error";
  if (connectionState === "reconnecting") return "warning";
  if (syncState === "error") return "error";
  if (syncState === "syncing") return "warning";
  if (syncState === "success") return "success";
  return "muted";
}

function getStatusLabel(
  connectionState: string,
  syncState: SyncState,
  lastSyncTime: Date | null,
  syncError: string | null,
): string {
  if (connectionState === "disconnected") return "Server offline";
  if (connectionState === "reconnecting") return "Reconnecting…";
  if (syncState === "error") return syncError || "Sync failed";
  if (syncState === "syncing") return "Syncing…";
  if (syncState === "success" && lastSyncTime)
    return `Synced ${formatTimeAgo(lastSyncTime)}`;
  return "Ready";
}

const colorMap: Record<StatusColor, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  muted: "var(--color-text-muted)",
};

export function SyncStatusButton({
  syncState,
  lastSyncTime,
  syncError,
  isUpdating,
  onRefresh,
}: SyncStatusButtonProps) {
  const { state: connectionState } = useConnectionStatus();
  const [showMenu, setShowMenu] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = getStatusColor(connectionState, syncState);
  const label = getStatusLabel(
    connectionState,
    syncState,
    lastSyncTime,
    syncError,
  );
  const color = colorMap[status];
  const spinning = syncState === "syncing" || isUpdating || isSpinning;

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    onRefresh();
    setTimeout(() => setIsSpinning(false), 1000);
  }, [onRefresh]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        className="flex items-center justify-center gap-1.5 cursor-pointer border-none rounded-md transition-colors"
        style={{
          background: "none",
          height: 44,
          minWidth: 44,
          padding: "0 6px",
        }}
        title={label}
        aria-label={label}
      >
        {connectionState === "disconnected" ? (
          <WifiOff size={16} style={{ color }} />
        ) : (
          <RefreshCw
            size={16}
            style={{ color }}
            className={spinning ? "animate-spin" : ""}
          />
        )}
        {/* Traffic-light dot */}
        <div
          className="rounded-full transition-all"
          style={{
            width: 8,
            height: 8,
            backgroundColor: color,
            boxShadow: status === "error" ? `0 0 6px ${color}` : undefined,
          }}
        />
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-50"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            minWidth: 220,
            boxShadow: "0 8px 24px var(--color-dialog-shadow)",
          }}
        >
          {/* Status header */}
          <div
            className="px-3 py-2 border-b flex items-center gap-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            {connectionState === "disconnected" ? (
              <WifiOff size={14} style={{ color }} />
            ) : (
              <Wifi
                size={14}
                style={{
                  color:
                    connectionState === "reconnecting"
                      ? "var(--color-warning)"
                      : "var(--color-success)",
                }}
              />
            )}
            <span className="text-xs font-medium" style={{ color }}>
              {label}
            </span>
          </div>

          {/* Sync details */}
          <div className="px-3 py-2">
            {lastSyncTime && (
              <div className="flex justify-between items-center mb-1">
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Last sync
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text)" }}
                >
                  {formatTimeAgo(lastSyncTime)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Connection
              </span>
              <span className="text-xs" style={{ color }}>
                {connectionState === "connected"
                  ? "Online"
                  : connectionState === "reconnecting"
                    ? "Reconnecting"
                    : "Offline"}
              </span>
            </div>
          </div>

          {/* Refresh action */}
          <div
            className="border-t px-1 py-1"
            style={{ borderColor: "var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => {
                handleRefresh();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer border-none transition-colors"
              style={{
                background: "none",
                color: "var(--color-text)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <RefreshCw
                size={14}
                className={spinning ? "animate-spin" : ""}
                style={{ color: "var(--color-accent)" }}
              />
              Sync now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
