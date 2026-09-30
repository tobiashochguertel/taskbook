import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useEncryptedStore } from "./useHookFactory";

export type SyncState = "idle" | "syncing" | "success" | "error";

export function useItems() {
  const store = useEncryptedStore({
    queryKey: "items-raw",
    getFn: api.getItems,
    putFn: api.putItems,
    trackSyncState: true,
  });

  return {
    items: store.items,
    itemsList: store.itemsList,
    isLoading: store.isLoading,
    error: store.error,
    refetch: store.refetch,
    updateItems: store.updateItems,
    isUpdating: store.isUpdating,
    syncState: store.syncState!,
    lastSyncTime: store.lastSyncTime!,
    syncError: store.syncError!,
  };
}

export function useArchive() {
  const store = useEncryptedStore({
    queryKey: "archive-raw",
    getFn: api.getArchive,
    putFn: api.putArchive,
  });

  return {
    archiveItems: store.items,
    archiveList: store.itemsList,
    updateArchive: store.updateItems,
    isArchiveLoading: store.isLoading,
  };
}

export function useEventSync() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`/api/v1/events?token=${token}`);
    eventSourceRef.current = es;

    const handleDataChanged = () => {
      // Debounce rapid SSE events — coalesce within 500ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["items-raw"] });
        queryClient.invalidateQueries({ queryKey: ["archive-raw"] });
        debounceRef.current = null;
      }, 500);
    };

    // Server sends named "data_changed" events — addEventListener is required.
    // (onmessage only handles unnamed events without an event: field.)
    es.addEventListener("data_changed", handleDataChanged);

    es.onerror = () => {
      // EventSource auto-reconnects; on reconnect trigger full sync
      if (es.readyState === EventSource.CONNECTING) {
        const onReopen = () => {
          queryClient.invalidateQueries({ queryKey: ["items-raw"] });
          queryClient.invalidateQueries({ queryKey: ["archive-raw"] });
          es.removeEventListener("open", onReopen);
        };
        es.addEventListener("open", onReopen);
      }
    };

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      es.removeEventListener("data_changed", handleDataChanged);
      es.close();
      eventSourceRef.current = null;
    };
  }, [token, queryClient]);
}

export function useUser() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token as string),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}
