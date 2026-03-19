---
title: "Quick Start"
description: "Get up and running with taskbook in minutes"
last_updated: "2025-07-18"
audience:
  - endusers
---

# Quick Start

## Install

Download the latest `tb` binary from [GitHub Releases](https://github.com/taskbook-sh/taskbook/releases) and place it on your `PATH`.

See [Installation](01-installation.md) for all installation methods (Nix, Cargo, build from source).

## Basic Usage

```bash
# View your boards
tb

# Create a task
tb --task "Review pull request"

# Create a task in a specific board with priority
tb --task @work "Deploy to production" p:3

# Mark task as complete
tb --check 1

# Start working on a task
tb --begin 2

# Create a note
tb --note "API endpoint: https://api.example.com"
```

## Organize with Boards

```bash
# Tasks are assigned to boards with the @ prefix
tb --task @personal "Buy groceries" p:2
tb --task @work @urgent "Fix login bug" p:3

# Move an item to another board
tb --move @3 shopping
```

## Search and Filter

```bash
# Find items by text
tb --find documentation

# Filter by attributes
tb --list pending
tb --list done starred

# View timeline
tb --timeline
```

## Optional: Server Sync

To sync tasks across devices, register with a server:

```bash
tb --register
```

Save the encryption key shown after registration — it cannot be recovered.

See [Sync & Encryption](../02-usage/02-sync.md) for full details.

## Next Steps

- [CLI Reference](../02-usage/01-cli-reference.md) — all commands and options
- [Configuration](03-configuration.md) — themes, display settings, data directories
