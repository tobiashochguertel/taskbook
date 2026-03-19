import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api, type TokenInfo } from "../lib/api";
import { TaskbookLogo } from "../components/ui/taskbook-logo";

export function ProfilePage() {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();

  const user = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(token!),
    enabled: !!token,
  });

  const tokens = useQuery({
    queryKey: ["tokens"],
    queryFn: () => api.listTokens(token!),
    enabled: !!token,
  });

  // Create token state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createToken(token!, newName, expiryDays ? parseInt(expiryDays) : undefined),
    onSuccess: (data) => {
      setCreatedToken(data.token);
      setNewName("");
      setExpiryDays("");
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeToken(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  });

  const handleCopy = useCallback(() => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdToken]);

  const handleDismissCreated = useCallback(() => {
    setCreatedToken(null);
    setShowCreate(false);
  }, []);

  useEffect(() => {
    setCopied(false);
  }, [createdToken]);

  // ESC to go back to board
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.location.href = "/";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-3 md:px-6 py-2 border-b safe-top"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 no-underline"
            style={{ color: "var(--color-accent)" }}
          >
            <TaskbookLogo size={20} />
            <span className="hidden md:inline text-base font-bold">
              Taskbook
            </span>
          </a>
          <span
            style={{ color: "var(--color-border)" }}
            className="hidden md:inline"
          >
            /
          </span>
          <h1
            className="text-base font-bold"
            style={{ color: "var(--color-text)", margin: 0 }}
          >
            Profile
          </h1>
        </div>
        <button
          onClick={logout}
          className="text-xs px-3 py-1.5 rounded cursor-pointer border-none"
          style={{
            color: "var(--color-error)",
            background: "none",
          }}
        >
          Sign out
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-6 md:space-y-8">
        {/* User Info Card */}
        <section
          className="rounded-lg p-6 border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: "var(--color-text)" }}
          >
            Account
          </h2>
          {user.isLoading ? (
            <p style={{ color: "var(--color-text-secondary)" }}>Loading...</p>
          ) : user.data ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium w-24"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Username
                </span>
                <span className="text-sm" style={{ color: "var(--color-text)" }}>
                  {user.data.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium w-24"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Email
                </span>
                <span className="text-sm" style={{ color: "var(--color-text)" }}>
                  {user.data.email}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {/* Personal Access Tokens */}
        <section
          className="rounded-lg p-6 border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              Personal Access Tokens
            </h2>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm px-3 py-1.5 rounded font-medium"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
              }}
            >
              + New Token
            </button>
          </div>

          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Tokens are used to authenticate with the API and MCP server.
            They are shown only once at creation — store them securely.
          </p>

          {/* Token created banner */}
          {createdToken && (
            <div
              className="rounded-lg p-4 mb-4 border"
              style={{
                background: "var(--color-success-bg, #f0fdf4)",
                borderColor: "var(--color-success, #22c55e)",
              }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-success, #22c55e)" }}>
                ✅ Token created — copy it now!
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-xs p-2 rounded font-mono break-all"
                  style={{
                    background: "var(--color-bg)",
                    color: "var(--color-text)",
                  }}
                >
                  {createdToken}
                </code>
                <button
                  onClick={handleCopy}
                  className="text-xs px-3 py-2 rounded font-medium shrink-0"
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={handleDismissCreated}
                className="text-xs mt-2 hover:opacity-80"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Create form */}
          {showCreate && !createdToken && (
            <div
              className="rounded-lg p-4 mb-4 border"
              style={{
                background: "var(--color-bg)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="space-y-3">
                <div>
                  <label
                    className="text-xs font-medium block mb-1"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. copilot-cli, ci-pipeline"
                    className="w-full text-sm p-2 rounded border"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium block mb-1"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Expiry (days, leave empty for no expiry)
                  </label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    placeholder="e.g. 90"
                    min={1}
                    max={3650}
                    className="w-full text-sm p-2 rounded border"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newName.trim() || createMutation.isPending}
                    className="text-sm px-3 py-1.5 rounded font-medium disabled:opacity-50"
                    style={{
                      background: "var(--color-accent)",
                      color: "#fff",
                    }}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Token"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setExpiryDays("");
                    }}
                    className="text-sm px-3 py-1.5 rounded"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Cancel
                  </button>
                </div>
                {createMutation.isError && (
                  <p className="text-xs" style={{ color: "var(--color-danger, #ef4444)" }}>
                    {(createMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Token list */}
          {tokens.isLoading ? (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Loading tokens...
            </p>
          ) : tokens.data?.tokens.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No tokens yet. Create one to use with the CLI or MCP server.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.data?.tokens.map((t: TokenInfo) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded border"
                  style={{
                    background: "var(--color-bg)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--color-text)" }}
                      >
                        {t.name}
                      </span>
                      <code
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--color-surface)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {t.token_prefix}...
                      </code>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Created {formatDate(t.created_at)}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Expires: {formatDate(t.expires_at)}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Last used: {formatDate(t.last_used_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Revoke token "${t.name}"?`)) {
                        revokeMutation.mutate(t.id);
                      }
                    }}
                    className="text-xs px-2 py-1 rounded hover:opacity-80 shrink-0 ml-2"
                    style={{ color: "var(--color-danger, #ef4444)" }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
