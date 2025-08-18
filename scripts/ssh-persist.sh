#!/usr/bin/env bash
set -euo pipefail

# Persist deploy key from .tmp to ~/.ssh and add a host alias 'github-dnsweeper'.
# Safe to re-run.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp"
KEY_TMP="$TMP_DIR/deploy_key"

if [[ ! -f "$KEY_TMP" ]]; then
  echo "Missing $KEY_TMP. Generate it first: bash scripts/setup-deploy-key.sh" >&2
  exit 1
fi

install -d -m 700 "$HOME/.ssh"
install -m 600 "$KEY_TMP" "$HOME/.ssh/dnsweeper"
install -m 644 "$KEY_TMP.pub" "$HOME/.ssh/dnsweeper.pub"

CFG="$HOME/.ssh/config"
touch "$CFG"
chmod 600 "$CFG"

if ! grep -q "^Host github-dnsweeper" "$CFG" 2>/dev/null; then
  cat >>"$CFG" <<CFG
Host github-dnsweeper
  HostName github.com
  User git
  IdentityFile ~/.ssh/dnsweeper
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG
fi

echo "Persisted deploy key to ~/.ssh and configured Host 'github-dnsweeper'."
echo "Test: ssh -T github-dnsweeper"

