# 08 — Real-Time Sync

## Overview

The server broadcasts `data_changed` events over SSE at `GET /api/v1/events`.
The SPA subscribes to this stream and uses it to **invalidate TanStack Query caches**,
triggering automatic background refetches. No manual polling is needed.

SSE event payload:
```
event: data_changed
data: items        ← active items changed
```
or
```
event: data_changed
data: archive      ← archived items changed
```

---

## `useSync` Hook

**File:** `src/hooks/useSync.ts`

```typescript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Opens a persistent SSE connection to /api/v1/events.
 * On every `data_changed` event, invalidates the relevant TanStack Query cache key.
 * Automatically reconnects on disconnect (exponential backoff, max 30s).
 * Closes the connection on logout (token === null).
 */
export function useSync(): { isConnected: boolean; lastEvent: string | null } {
  // Implementation:
  // 1. Get token from auth store
  // 2. If no token, return { isConnected: false, lastEvent: null }
  // 3. Open EventSource to /api/v1/events with Authorization header
  //    NOTE: EventSource does not support custom headers natively.
  //    Use a fetch-based SSE polyfill or connect via URL param token
  //    (server must support ?token= query param — see note below).
  // 4. On 'data_changed' event:
  //    - data === 'items'   → queryClient.invalidateQueries({ queryKey: ['items'] })
  //    - data === 'archive' → queryClient.invalidateQueries({ queryKey: ['archive'] })
  // 5. On error: schedule reconnect with exponential backoff
  // 6. Cleanup on unmount / token change: close EventSource
}
```

### EventSource + Auth Header Workaround

The browser's native `EventSource` API does not support custom headers. Two options:

**Option A (Recommended):** Use the `@microsoft/fetch-event-source` polyfill, which
uses `fetch()` under the hood and supports headers:

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

await fetchEventSource(`${import.meta.env.VITE_API_BASE_URL}/api/v1/events`, {
  headers: { Authorization: `Bearer ${token}` },
  onmessage(ev) { /* handle ev.event, ev.data */ },
  onerror(err) { /* trigger reconnect */ },
  signal: abortController.signal,
});
```

Add to `package.json` dependencies:
```json
"@microsoft/fetch-event-source": "^2.0.1"
```

**Option B:** Pass the token as a query parameter (`?token=<value>`) and extend the
server's `AuthUser` extractor to also check query params. This is less secure (token
appears in server logs) and is **not recommended**.

---

## TanStack Query Key Convention

```typescript
// Active items
export const ITEMS_QUERY_KEY = ['items'] as const;

// Archive
export const ARCHIVE_QUERY_KEY = ['archive'] as const;

// Current user
export const ME_QUERY_KEY = ['me'] as const;
```

---

## `useItems` Hook

**File:** `src/hooks/useItems.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getItems, putItems } from '@/lib/api';
import { useEncryption } from '@/hooks/useEncryption';
import { ITEMS_QUERY_KEY } from '@/hooks/useSync';
import type { ItemsMap } from '@/lib/api/types';

export function useItems() {
  const { decryptItems, encryptItems, isReady } = useEncryption();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ITEMS_QUERY_KEY,
    enabled: isReady,
    queryFn: async () => {
      const response = await getItems();           // generated API call
      return decryptItems(response.data.items);    // decrypt in browser
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (items: ItemsMap) => {
      const encrypted = await encryptItems(items);
      await putItems({ body: { items: encrypted } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY });
    },
  });

  return { ...query, save: mutation.mutateAsync, isSaving: mutation.isPending };
}
```

---

## `useArchive` Hook

**File:** `src/hooks/useArchive.ts`

Same pattern as `useItems` but using `getItemsArchive` / `putItemsArchive` and
`ARCHIVE_QUERY_KEY`. Provides `archiveTask(id)` and `unarchiveTask(id)` mutation helpers.

---

## Reconnection Strategy

```typescript
// Exponential backoff constants
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const BACKOFF_FACTOR = 2;

// State machine: CONNECTING → OPEN → (error) → RECONNECTING → CONNECTING ...
```

The `StatusBar` component (see `09-ui-components.md`) displays the connection state:
- 🟢 Synced — SSE connected, last sync timestamp
- 🟡 Reconnecting… — exponential backoff in progress
- 🔴 Offline — no connection, working from cache

---

## Acceptance Criteria — Real-Time Sync

- [ ] `useSync` opens an SSE connection immediately after a valid token is available
- [ ] A `data_changed: items` event causes `queryClient.invalidateQueries(['items'])`
  within 100ms of the event arriving
- [ ] A `data_changed: archive` event causes `queryClient.invalidateQueries(['archive'])`
- [ ] If the SSE connection drops, `useSync` reconnects automatically with exponential
  backoff (tested by MSW closing the stream)
- [ ] `useSync` closes the SSE connection and stops reconnecting when the token is cleared
  (logout)
- [ ] The `StatusBar` reflects connection state: connected / reconnecting / offline
- [ ] Unit test (`tests/unit/hooks/useSync.test.ts`): MSW streams two events; assert
  `invalidateQueries` is called twice with the correct keys
- [ ] E2E test (`tests/e2e/sync.spec.ts`): two browser tabs open the board; a task created
  in tab A appears in tab B within 2 seconds (requires a live server or MSW SSE simulation)
- [ ] `@microsoft/fetch-event-source` is listed as a runtime dependency