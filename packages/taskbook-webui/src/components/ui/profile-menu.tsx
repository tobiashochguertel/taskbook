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
  return `hsl(${hue}, 35%, 50%)`;
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
  const avatarBg = getAvatarColor(username || email || "user");

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

  const menuItems = [
    {
      icon: <User size={14} />,
      label: "Profile & Tokens",
      href: "/profile",
    },
    {
      icon: <Settings size={14} />,
      label: "Settings",
      onClick: onOpenSettings,
    },
    {
      icon: <Shield size={14} />,
      label: "API Docs",
      href: "/api/docs",
      external: true,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        className="flex items-center justify-center cursor-pointer rounded-full transition-opacity"
        style={{
          width: 28,
          height: 28,
          backgroundColor: "transparent",
          border: `1.5px solid ${avatarBg}`,
          color: avatarBg,
          fontSize: 11,
          fontWeight: 500,
          fontFamily: "var(--font-mono)",
          opacity: showMenu ? 1 : 0.7,
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
            {menuItems.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer no-underline transition-colors"
                  style={{ color: "var(--color-text)" }}
                  onClick={() => setShowMenu(false)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer border-none transition-colors"
                  style={{
                    background: "none",
                    color: "var(--color-text)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--color-surface-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ),
            )}
          </div>

          {/* Version info */}
          <div
            className="border-t px-3 py-1.5"
            style={{ borderColor: "var(--color-border)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
            >
              Taskbook{" "}
              {typeof __APP_VERSION__ !== "undefined"
                ? __APP_VERSION__
                : "dev"}
            </span>
          </div>

          {/* Logout */}
          <div
            className="border-t px-1 py-1"
            style={{ borderColor: "var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => {
                onLogout();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer border-none transition-colors"
              style={{
                background: "none",
                color: "var(--color-error)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--color-surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

declare const __APP_VERSION__: string;
