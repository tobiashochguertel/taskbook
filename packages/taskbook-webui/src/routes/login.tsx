import { useEffect } from "react";
import { parseAuthCallback, useAuth } from "../lib/auth";

export function LoginPage() {
  const { login, setCredentials, isAuthenticated } = useAuth();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const { token, encryptionKey } = parseAuthCallback(hash);
      if (token) {
        setCredentials(token, encryptionKey);
        // Clean the hash from the URL
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
    }
  }, [setCredentials]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="p-8 rounded-lg text-center max-w-md w-full"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <div className="mb-6">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--color-accent)" }}
          >
            ⚡ Taskbook
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            Tasks, boards, and notes for the command-line
          </p>
        </div>

        <button
          type="button"
          onClick={login}
          className="w-full py-3 px-6 rounded-md font-semibold text-sm transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-bg)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--color-accent-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--color-accent)")
          }
        >
          Login with SSO
        </button>

        <p
          className="mt-4 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          Authenticates via your organization's identity provider
        </p>
      </div>
    </div>
  );
}
