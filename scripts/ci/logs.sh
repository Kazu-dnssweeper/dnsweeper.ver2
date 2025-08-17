#!/usr/bin/env bash
set -euo pipefail

REPO="${CI_REPO:-Kazu-dnssweeper/dnsweeper.ver2}"
TOKEN="${GITHUB_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  # Try reading from ~/.config/dnsweeper/token
  CONF_TOKEN_FILE="$HOME/.config/dnsweeper/token"
  if [[ -f "$CONF_TOKEN_FILE" ]]; then
    TOKEN="$(cat "$CONF_TOKEN_FILE" | tr -d '\n' | tr -d '\r')"
  fi
fi
if [[ -z "$TOKEN" ]]; then
  echo "GITHUB_TOKEN is required (env GITHUB_TOKEN or ~/.config/dnsweeper/token)" >&2
  exit 1
fi

mkdir -p .tmp
curl -sS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/actions/runs?per_page=1" > .tmp/gha_runs.json
RUN_ID=$(node -e 'const j=require("./.tmp/gha_runs.json");process.stdout.write(String(j.workflow_runs?.[0]?.id||""));')
if [[ -z "$RUN_ID" ]]; then
  echo "No run found" >&2
  exit 0
fi
OUT=".tmp/gha_logs.latest"
rm -rf "$OUT" && mkdir -p "$OUT"
curl -L -sS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/logs" -o "$OUT/logs.zip"
unzip -oq "$OUT/logs.zip" -d "$OUT" || true
echo "Logs downloaded to: $OUT" >&2
