---
title: "Taskbook WebUI"
description: "React web interface for Taskbook"
last_updated: "2025-07-18"
---

# taskbook-webui

React + Vite single-page application for managing tasks, notes, and boards in the browser. Built to be served by `tb-server` or as a standalone container via Caddy/nginx.

## Features

- **Board view** — drag-free card layout with priority badges, progress tracking
- **Task & note management** — create, edit, check, star, delete, restore
- **Archive** — browse and restore deleted items
- **Settings dialog** — theme, sync, display preferences
- **Sidebar navigation** — board list, filters, quick actions
- **Command palette** — keyboard-driven actions (`Cmd+K` / `Ctrl+K`)
- **Mobile responsive** — bottom tabs, sheets, and FAB for small screens
- **Login** — supports password and OIDC/SSO authentication

## Tech Stack

| Dependency                                     | Purpose                 |
| ---------------------------------------------- | ----------------------- |
| [React](https://react.dev) 19                  | UI framework            |
| [Vite](https://vite.dev) 8                     | Build tool & dev server |
| [TypeScript](https://typescriptlang.org)       | Type safety             |
| [Tailwind CSS](https://tailwindcss.com) 4      | Utility-first styling   |
| [TanStack Router](https://tanstack.com/router) | Client-side routing     |
| [TanStack Query](https://tanstack.com/query)   | Server-state management |
| [Motion](https://motion.dev)                   | Animations              |
| [Lucide](https://lucide.dev)                   | Icons                   |
| [cmdk](https://cmdk.paco.me)                   | Command palette         |
| [Biome](https://biomejs.dev)                   | Linter & formatter      |
| [Vitest](https://vitest.dev)                   | Unit tests              |

## Development

```bash
bun install
bun run dev        # Vite dev server with HMR
```

The dev server proxies API requests to `tb-server` (default `http://localhost:8080`).

### Lint & Test

```bash
bun run lint       # Biome check
bun run lint:fix   # Biome auto-fix
bun run test       # Vitest (single run)
bun run test:watch # Vitest (watch mode)
```

## Building

```bash
bun run build      # Production build → dist/
bun run preview    # Preview the production build locally
```

## Docker

Built via `Dockerfile.webui` in the repository root:

```bash
docker build -f Dockerfile.webui -t taskbook-webui .
docker run -p 8080:8080 taskbook-webui
```

The image uses a multi-stage build (Bun → Caddy) to serve the static `dist/` output.

## Configuration

The WebUI fetches runtime configuration from the `tb-server` API at startup — no build-time environment variables are required. Server URL, OIDC settings, and feature flags are all provided by the backend.

## Project Structure

```
src/
├── main.tsx                 # Entry point
├── app.tsx                  # Root component & providers
├── routes/                  # Page routes (board, login)
├── components/ui/           # Reusable UI components
├── hooks/                   # Custom React hooks
├── lib/                     # Utilities
└── styles/                  # Global styles
```
