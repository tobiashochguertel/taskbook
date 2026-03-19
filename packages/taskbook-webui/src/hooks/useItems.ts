import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type EncryptedItemData, type ItemsMap } from "../lib/api";
import { useAuth } from "../lib/auth";
import { decrypt, deriveKey, encrypt } from "../lib/crypto";
import { normalizeItem, type StorageItem } from "../lib/types";

export type SyncState = "idle" | "syncing" | "success" | "error";

async function decryptItems(
  items: ItemsMap,
  encryptionKey: string | null,
): Promise<Record<string, StorageItem>> {
  if (!encryptionKey) return {};

  let key: CryptoKey;
  try {
    key = await deriveKey(encryptionKey);
  } catch {
    console.error("Failed to derive encryption key");
    return {};
  }

  const result: Record<string, StorageItem> = {};
  for (const [id, encrypted] of Object.entries(items)) {
    try {
      const plaintext = await decrypt(encrypted.data, encrypted.nonce, key);
      const raw = JSON.parse(plaintext);
      result[id] = normalizeItem(raw);
    } catch (e) {
      console.error(`Failed to decrypt item ${id}:`, e);
    }
  }
  return result;
}

async function encryptItem(
  item: StorageItem,
  encryptionKey: string,
): Promise<EncryptedItemData> {
  const key = await deriveKey(encryptionKey);
  const plaintext = JSON.stringify(item);
  return encrypt(plaintext, key);
}

export function useItems() {
  const { token, encryptionKey } = useAuth();
  const queryClient = useQueryClient();

  const rawQuery = useQuery({
    queryKey: ["items-raw"],
    queryFn: () => api.getItems(token as string),
    enabled: !!token,
    staleTime: 30_000,
  });

  const [items, setItems] = useState<Record<string, StorageItem>>({});
  const [decrypting, setDecrypting] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Track whether a mutation is in-flight to suppress refetch-based overwrites
  const mutatingRef = useRef(false);

  useEffect(() => {
    // Don't overwrite optimistic state while a mutation is in-flight
    if (mutatingRef.current) return;
    if (rawQuery.data?.items) {
      setDecrypting(true);
      decryptItems(rawQuery.data.items, encryptionKey).then((decrypted) => {
        // Double-check mutation didn't start while we were decrypting
        if (!mutatingRef.current) {
          setItems(decrypted);
          setSyncState("success");
          setLastSyncTime(new Date());
          setSyncError(null);
        }
        setDecrypting(false);
      });
    }
  }, [rawQuery.data, encryptionKey]);

  const itemsList = useMemo(() => Object.values(items), [items]);

  const updateMutation = useMutation({
    mutationFn: async (updatedItems: Record<string, StorageItem>) => {
      if (!token || !encryptionKey) throw new Error("Not authenticated");
      const encrypted: ItemsMap = {};
      for (const [id, item] of Object.entries(updatedItems)) {
        encrypted[id] = await encryptItem(item, encryptionKey);
      }
      return api.putItems(token, encrypted);
    },
    onMutate: async (updatedItems) => {
      mutatingRef.current = true;
      // Cancel in-flight fetches to prevent stale data from overwriting
      await queryClient.cancelQueries({ queryKey: ["items-raw"] });
      const previous = { ...items };
      setItems(updatedItems);
      setSyncState("syncing");
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setItems(context.previous);
      setSyncState("error");
      setSyncError(_err instanceof Error ? _err.message : "Sync failed");
      mutatingRef.current = false;
    },
    onSuccess: () => {
      setSyncState("success");
      setLastSyncTime(new Date());
      setSyncError(null);
      mutatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["items-raw"] });
    },
    onSettled: () => {
      mutatingRef.current = false;
    },
  });

  return {
    items,
    itemsList,
    isLoading: rawQuery.isLoading || decrypting,
    error: rawQuery.error,
    refetch: rawQuery.refetch,
    updateItems: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    syncState,
    lastSyncTime,
    syncError,
  };
}

export function useArchive() {
  const { token, encryptionKey } = useAuth();
  const queryClient = useQueryClient();

  const rawQuery = useQuery({
    queryKey: ["archive-raw"],
    queryFn: () => api.getArchive(token as string),
    enabled: !!token,
    staleTime: 30_000,
  });

  const [archiveItems, setArchiveItems] = useState<Record<string, StorageItem>>(
    {},
  );
  const [decrypting, setDecrypting] = useState(false);
  const mutatingRef = useRef(false);

  useEffect(() => {
    if (mutatingRef.current) return;
    if (rawQuery.data?.items) {
      setDecrypting(true);
      decryptItems(rawQuery.data.items, encryptionKey).then((decrypted) => {
        if (!mutatingRef.current) {
          setArchiveItems(decrypted);
        }
        setDecrypting(false);
      });
    }
  }, [rawQuery.data, encryptionKey]);

  const archiveList = useMemo(
    () => Object.values(archiveItems),
    [archiveItems],
  );

  const updateMutation = useMutation({
    mutationFn: async (updatedItems: Record<string, StorageItem>) => {
      if (!token || !encryptionKey) throw new Error("Not authenticated");
      const encrypted: ItemsMap = {};
      for (const [id, item] of Object.entries(updatedItems)) {
        encrypted[id] = await encryptItem(item, encryptionKey);
      }
      return api.putArchive(token, encrypted);
    },
    onMutate: async (updatedItems) => {
      mutatingRef.current = true;
      await queryClient.cancelQueries({ queryKey: ["archive-raw"] });
      const previous = { ...archiveItems };
      setArchiveItems(updatedItems);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setArchiveItems(context.previous);
      mutatingRef.current = false;
    },
    onSuccess: () => {
      mutatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["archive-raw"] });
    },
    onSettled: () => {
      mutatingRef.current = false;
    },
  });

  return {
    archiveItems,
    archiveList,
    updateArchive: updateMutation.mutate,
    isArchiveLoading: rawQuery.isLoading || decrypting,
  };
}

export function useEventSync() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`/api/v1/events?token=${token}`);
    eventSourceRef.current = es;

    es.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["items-raw"] });
      queryClient.invalidateQueries({ queryKey: ["archive-raw"] });
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
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
