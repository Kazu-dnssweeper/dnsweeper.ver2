#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp"
SSH_CFG="$TMP_DIR/ssh_config"

if ssh -T github-dnsweeper 2>&1 | grep -q "successfully authenticated"; then
  echo "OK: persistent SSH (github-dnsweeper) works."
  exit 0
fi

if [[ -f "$SSH_CFG" ]]; then
  if GIT_SSH_COMMAND="ssh -F $SSH_CFG" ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "OK: temporary SSH via $SSH_CFG works."
    exit 0
  fi
fi

echo "WARN: SSH test failed. Ensure deploy key is added to GitHub and 'scripts/setup-deploy-key.sh' was run." >&2
exit 1

