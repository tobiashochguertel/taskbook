#!/usr/bin/env bash
# Format all Markdown files in the project using Prettier
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "📝 Formatting Markdown files..."
prettier --write "**/*.md" --ignore-path .gitignore 2>/dev/null || {
    echo "⚠️  Prettier not found. Install with: bun add -g prettier"
    exit 1
}
echo "✅ Done"
