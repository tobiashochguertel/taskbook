import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";

function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
    }).trim();
    const tag =
      execSync("git describe --tags --abbrev=0 2>/dev/null || echo ''", {
        encoding: "utf8",
      }).trim() || undefined;
    return { hash, tag };
  } catch {
    return { hash: "unknown", tag: undefined };
  }
}

export default defineConfig(() => {
  const git = getGitInfo();
  const pkg = require("./package.json");
  const version = git.tag || `v${pkg.version}`;
  const buildDate = new Date().toISOString().split("T")[0];
  const appVersion = `${version} (${git.hash}) ${buildDate}`;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8080",
        "/auth": "http://localhost:8080",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
