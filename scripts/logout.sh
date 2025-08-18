#!/usr/bin/env bash
set -euo pipefail

# Cleanup local credentials/config so that no secrets remain after use.
# By default this script runs in DRY-RUN mode and only prints what it would do.
# Use --force to actually delete files and edit ~/.ssh/config.
#
# Actions (scoped to this repo and current user):
# - Remove repo-local deploy key and ssh_config under .tmp/
# - Remove persistent keys ~/.ssh/dnsweeper{,.pub} (if present)
# - Remove Host github-dnsweeper block from ~/.ssh/config
# - Remove ~/.config/dnsweeper/token (fine‑grained PAT)
# - Print instructions to revoke Deploy Key and PAT on GitHub (server‑side)

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

ROOT_DIR="\$(cd "\$(dirname "$0")/.." && pwd)"
TMP_DIR="$ROOT_DIR/.tmp"

todo=()
add() { todo+=("$1"); }

# Repo-local
[[ -f "$TMP_DIR/deploy_key" ]] && add "rm -f '$TMP_DIR/deploy_key' '$TMP_DIR/deploy_key.pub'"
[[ -f "$TMP_DIR/ssh_config" ]] && add "rm -f '$TMP_DIR/ssh_config'"

# User token
CONF_TOKEN_FILE="$HOME/.config/dnsweeper/token"
[[ -f "$CONF_TOKEN_FILE" ]] && add "rm -f '$CONF_TOKEN_FILE'"

# SSH keys under HOME
[[ -f "$HOME/.ssh/dnsweeper" ]] && add "rm -f '$HOME/.ssh/dnsweeper' '$HOME/.ssh/dnsweeper.pub'"

# ~/.ssh/config host entry removal (create backup first)
if [[ -f "$HOME/.ssh/config" ]] && grep -q '^Host github-dnsweeper\b' "$HOME/.ssh/config"; then
  add "backup ~/.ssh/config -> ~/.ssh/config.bak.$(date +%s) && remove Host github-dnsweeper block"
fi

echo "[logout] Planned actions:" >&2
for a in "${todo[@]}"; do echo "  - $a" >&2; done
if (( FORCE == 0 )); then
  echo "[logout] DRY-RUN. Run again with --force to apply." >&2
  exit 0
fi

# Execute
[[ -f "$TMP_DIR/deploy_key" ]] && rm -f "$TMP_DIR/deploy_key" "$TMP_DIR/deploy_key.pub" || true
[[ -f "$TMP_DIR/ssh_config" ]] && rm -f "$TMP_DIR/ssh_config" || true
[[ -f "$CONF_TOKEN_FILE" ]] && rm -f "$CONF_TOKEN_FILE" || true
[[ -f "$HOME/.ssh/dnsweeper" ]] && rm -f "$HOME/.ssh/dnsweeper" "$HOME/.ssh/dnsweeper.pub" || true

if [[ -f "$HOME/.ssh/config" ]] && grep -q '^Host github-dnsweeper\b' "$HOME/.ssh/config"; then
  BAK="$HOME/.ssh/config.bak.$(date +%s)"
  cp "$HOME/.ssh/config" "$BAK"
  awk '
    BEGIN{skip=0}
    /^Host github-dnsweeper(\s|")?/{skip=1; next}
    /^Host\s/ && skip==1 {skip=0}
    skip==0 {print}
  ' "$BAK" > "$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
  echo "[logout] Edited ~/.ssh/config (backup: $BAK)" >&2
fi

echo "[logout] Local credentials removed." >&2
echo "[logout] Server-side revocation recommended:" >&2
echo "  - Remove Deploy Key in GitHub: Repo → Settings → Deploy keys" >&2
echo "  - Revoke PAT in GitHub: Settings → Developer settings → Tokens" >&2

