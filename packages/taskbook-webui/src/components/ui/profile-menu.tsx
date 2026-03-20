import { LogOut, Settings, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ProfileMenuProps {
  username?: string;
  email?: string;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function getInitials(username?: string, email?: string): string {
  const name = username || email || "?";
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 55%)`;
}

function MenuRow({
  icon,
  label,
  href,
  external,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  danger?: boolean;
}) {
  const style = {
    color: danger ? "var(--color-error)" : "var(--color-text)",
    background: "none" as const,
  };

  const cls =
    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer border-none no-underline transition-colors";

  const hover = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.backgroundColor = "var(--color-surface-hover)");
  const unhover = (e: React.MouseEvent<HTMLElement>) =>
    (e.currentTarget.style.backgroundColor = "transparent");

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cls}
        style={style}
        onClick={onClick}
        onMouseEnter={hover}
        onMouseLeave={unhover}
      >
        <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
        {label}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={style}
      onMouseEnter={hover}
      onMouseLeave={unhover}
    >
      <span style={{ color: danger ? undefined : "var(--color-text-muted)" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

export function ProfileMenu({
  username,
  email,
  onOpenSettings,
  onLogout,
}: ProfileMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = getInitials(username, email);
  const avatarColor = getAvatarColor(username || email || "user");

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

  // ESC to close
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenu(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showMenu]);

  const close = () => setShowMenu(false);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        className="flex items-center justify-center cursor-pointer rounded-full transition-all"
        style={{
          width: 26,
          height: 26,
          backgroundColor: showMenu ? avatarColor : "transparent",
          border: `1.5px solid ${avatarColor}`,
          color: showMenu ? "#fff" : avatarColor,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
          opacity: showMenu ? 1 : 0.65,
          letterSpacing: 0,
        }}
        title={username || email || "Profile"}
        aria-label="Profile menu"
      >
        {initial}
      </button>

      {showMenu && (
        <div
          className="absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-50"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            minWidth: 200,
            boxShadow: "0 8px 24px var(--color-dialog-shadow)",
          }}
        >
          {/* User info header */}
          <div
            className="px-3 py-2.5 border-b"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="text-sm font-medium truncate"
              style={{ color: "var(--color-text)" }}
            >
              {username || "User"}
            </div>
            {email && email !== username && (
              <div
                className="text-xs truncate mt-0.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                {email}
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="px-1 py-1">
            <MenuRow
              icon={<User size={14} />}
              label="Profile & Tokens"
              href="/profile"
              onClick={close}
            />
            <MenuRow
              icon={<Settings size={14} />}
              label="Settings"
              onClick={() => {
                onOpenSettings();
                close();
              }}
            />
            <MenuRow
              icon={<Shield size={14} />}
              label="API Docs"
              href="/api/docs"
              external
              onClick={close}
            />
          </div>

          {/* Version info */}
          <div
            className="border-t px-3 py-1.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
            >
              Taskbook{" "}
              {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}
            </span>
          </div>

          {/* Logout */}
          <div
            className="border-t px-1 py-1"
            style={{ borderColor: "var(--color-border)" }}
          >
            <MenuRow
              icon={<LogOut size={14} />}
              label="Sign out"
              danger
              onClick={() => {
                onLogout();
                close();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

declare const __APP_VERSION__: string;
