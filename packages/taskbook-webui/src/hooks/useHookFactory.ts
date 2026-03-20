import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EncryptedItemData, ItemsMap, ItemsResponse } from "../lib/api";
import { useAuth } from "../lib/auth";
import { decrypt, deriveKey, encrypt } from "../lib/crypto";
import { normalizeItem, type StorageItem } from "../lib/types";

import type { SyncState } from "./useItems";

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

export interface EncryptedStoreConfig {
  queryKey: string;
  getFn: (token: string) => Promise<ItemsResponse>;
  putFn: (token: string, items: ItemsMap) => Promise<void>;
  trackSyncState?: boolean;
}

interface BaseSyncFields {
  syncState: SyncState;
  lastSyncTime: Date | null;
  syncError: string | null;
}

export interface EncryptedStoreResult extends Partial<BaseSyncFields> {
  items: Record<string, StorageItem>;
  itemsList: StorageItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  updateItems: (items: Record<string, StorageItem>) => void;
  isUpdating: boolean;
}

export function useEncryptedStore(
  config: EncryptedStoreConfig,
): EncryptedStoreResult {
  const { queryKey, getFn, putFn, trackSyncState = false } = config;
  const { token, encryptionKey } = useAuth();
  const queryClient = useQueryClient();

  const rawQuery = useQuery({
    queryKey: [queryKey],
    queryFn: () => getFn(token as string),
    enabled: !!token,
    staleTime: 30_000,
  });

  const [items, setItems] = useState<Record<string, StorageItem>>({});
  const [decrypting, setDecrypting] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const mutatingRef = useRef(false);

  useEffect(() => {
    if (mutatingRef.current) return;
    if (rawQuery.data?.items) {
      setDecrypting(true);
      decryptItems(rawQuery.data.items, encryptionKey)
        .then((decrypted) => {
          if (!mutatingRef.current) {
            setItems(decrypted);
            if (trackSyncState) {
              setSyncState("success");
              setLastSyncTime(new Date());
              setSyncError(null);
            }
          }
          setDecrypting(false);
        })
        .catch((err) => {
          console.error("Decrypt cycle failed, scheduling refetch:", err);
          setDecrypting(false);
          if (!mutatingRef.current) {
            if (trackSyncState) {
              setSyncState("error");
              setSyncError("Decryption failed — retrying…");
            }
            setTimeout(() => rawQuery.refetch(), 1000);
          }
        });
    }
  }, [rawQuery.data, encryptionKey, trackSyncState]);

  const itemsList = useMemo(() => Object.values(items), [items]);

  const updateMutation = useMutation({
    mutationFn: async (updatedItems: Record<string, StorageItem>) => {
      if (!token || !encryptionKey) throw new Error("Not authenticated");
      const encrypted: ItemsMap = {};
      for (const [id, item] of Object.entries(updatedItems)) {
        encrypted[id] = await encryptItem(item, encryptionKey);
      }
      return putFn(token, encrypted);
    },
    onMutate: async (updatedItems) => {
      mutatingRef.current = true;
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const previous = { ...items };
      setItems(updatedItems);
      if (trackSyncState) {
        setSyncState("syncing");
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setItems(context.previous);
      if (trackSyncState) {
        setSyncState("error");
        setSyncError(_err instanceof Error ? _err.message : "Sync failed");
      }
      mutatingRef.current = false;
    },
    onSuccess: () => {
      if (trackSyncState) {
        setSyncState("success");
        setLastSyncTime(new Date());
        setSyncError(null);
      }
      mutatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onSettled: () => {
      mutatingRef.current = false;
    },
  });

  const result: EncryptedStoreResult = {
    items,
    itemsList,
    isLoading: rawQuery.isLoading || decrypting,
    error: rawQuery.error,
    refetch: rawQuery.refetch,
    updateItems: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };

  if (trackSyncState) {
    result.syncState = syncState;
    result.lastSyncTime = lastSyncTime;
    result.syncError = syncError;
  }

  return result;
}
