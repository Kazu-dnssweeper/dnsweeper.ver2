#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp"
KEY_FILE="$TMP_DIR/deploy_key"
SSH_CFG="$TMP_DIR/ssh_config"

mkdir -p "$TMP_DIR"

if [[ ! -f "$KEY_FILE" ]]; then
  ssh-keygen -t ed25519 -C "dnsweeper-deploy" -N '' -f "$KEY_FILE" >/dev/null
fi

PUB_KEY=$(cat "$KEY_FILE.pub")

cat >"$SSH_CFG" <<CFG
Host github.com
  HostName github.com
  User git
  IdentityFile $KEY_FILE
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
CFG

echo "PUBLIC_KEY="$PUB_KEY""
echo "SSH config written: $SSH_CFG"
echo "Use: GIT_SSH_COMMAND=\"ssh -F $SSH_CFG\" git push -u origin main"

