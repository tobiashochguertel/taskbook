import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

const POLL_INTERVAL = 30_000; // 30 seconds
const TIMEOUT = 5_000; // 5 second fetch timeout

export function useConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("connected");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const wasDisconnected = useRef(false);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch("/api/v1/health", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const prev = wasDisconnected.current;
        wasDisconnected.current = false;
        setState("connected");
        setLastChecked(new Date());
        return prev; // return true if we just reconnected
      }
      wasDisconnected.current = true;
      setState("disconnected");
    } catch {
      if (state === "connected") {
        setState("reconnecting");
      } else {
        wasDisconnected.current = true;
        setState("disconnected");
      }
    }
    return false;
  }, [state]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { state, lastChecked };
}
