import { useEffect, useState } from "react";
import { parseAuthCallback, useAuth } from "../lib/auth";

export function LoginPage() {
  const { login, setCredentials, isAuthenticated } = useAuth();
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newEncryptionKey, setNewEncryptionKey] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const { token, encryptionKey, newUser } = parseAuthCallback(hash);
      if (token) {
        setCredentials(token, encryptionKey);
        // Clean the hash from the URL
        window.history.replaceState(null, "", window.location.pathname);

        if (newUser && encryptionKey) {
          setNewEncryptionKey(encryptionKey);
          setShowKeyModal(true);
        }
        return;
      }
    }
  }, [setCredentials]);

  // Redirect if authenticated (but not while showing key modal)
  useEffect(() => {
    if (isAuthenticated && !showKeyModal) {
      window.location.href = "/";
    }
  }, [isAuthenticated, showKeyModal]);

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

      {showKeyModal && newEncryptionKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "var(--color-backdrop)" }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "var(--color-warning)" }}
            >
              ⚠️ Save Your Encryption Key
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              Your data is encrypted with this key. Save it somewhere safe — it
              cannot be recovered.
            </p>
            <div
              className="p-3 rounded-lg mb-4 font-mono text-sm break-all"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              {newEncryptionKey}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  color: "var(--color-text)",
                }}
                onClick={() => navigator.clipboard.writeText(newEncryptionKey)}
              >
                Copy Key
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "white",
                }}
                onClick={() => {
                  setShowKeyModal(false);
                  window.location.href = "/";
                }}
              >
                I've Saved It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
