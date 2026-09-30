import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "tb_auth";

export interface AuthState {
  token: string | null;
  encryptionKey: string | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  setCredentials: (token: string, encryptionKey: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): {
  token: string;
  encryptionKey: string | null;
} | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveAuth(token: string, encryptionKey: string | null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, encryptionKey }));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Parse token and encryption_key from URL hash fragment after OIDC redirect */
export function parseAuthCallback(hash: string): {
  token: string | null;
  encryptionKey: string | null;
  newUser: boolean;
} {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    token: params.get("token"),
    encryptionKey: params.get("encryption_key"),
    newUser: params.get("new_user") === "true",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = loadStoredAuth();
    return stored?.token ?? null;
  });
  const [encryptionKey, setEncryptionKey] = useState<string | null>(() => {
    const stored = loadStoredAuth();
    return stored?.encryptionKey ?? null;
  });

  const isAuthenticated = token !== null;

  const login = useCallback(() => {
    const redirectUri = `${window.location.origin}/login`;
    window.location.href = `/auth/oidc/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setEncryptionKey(null);
    clearAuth();
  }, []);

  const setCredentials = useCallback(
    (newToken: string, newEncryptionKey: string | null) => {
      setToken(newToken);
      setEncryptionKey(newEncryptionKey);
      saveAuth(newToken, newEncryptionKey);
    },
    [],
  );

  const value = useMemo(
    () => ({
      token,
      encryptionKey,
      isAuthenticated,
      login,
      logout,
      setCredentials,
    }),
    [token, encryptionKey, isAuthenticated, login, logout, setCredentials],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
