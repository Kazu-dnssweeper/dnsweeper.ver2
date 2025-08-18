#!/usr/bin/env bash
set -euo pipefail

# Point Git hooks to scripts/git-hooks and make hooks executable

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/scripts/git-hooks"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "No hooks dir: $HOOKS_DIR" >&2
  exit 1
fi

chmod -R +x "$HOOKS_DIR"
git config core.hooksPath "$HOOKS_DIR"
echo "Configured git hooksPath -> $HOOKS_DIR"

