#!/usr/bin/env bash
set -euo pipefail

# Safe HTTPS push using a Fine-grained PAT.
# Reads token from $GITHUB_TOKEN or ~/.config/dnsweeper/token
# Usage: scripts/ci/push.sh [branch] [commit-message]

BRANCH="${1:-}"
MSG="${2:-}"

if [[ -z "$BRANCH" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
fi

if [[ -z "$MSG" ]]; then
  MSG="chore: push via PAT (monorepo & rules updates)"
fi

TOKEN="${GITHUB_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  CONF_TOKEN_FILE="$HOME/.config/dnsweeper/token"
  if [[ -f "$CONF_TOKEN_FILE" ]]; then
    TOKEN="$(tr -d '\r\n' < "$CONF_TOKEN_FILE")"
  fi
fi

if [[ -z "$TOKEN" ]]; then
  echo "GITHUB_TOKEN is required (env or ~/.config/dnsweeper/token)" >&2
  exit 1
fi

# Stage & commit if needed
git add -A || true
if ! git diff --cached --quiet; then
  git commit -m "$MSG" || true
fi

# Derive HTTPS URL for origin without printing the token
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
if [[ -z "$ORIGIN_URL" ]]; then
  echo "No origin remote set" >&2
  exit 1
fi

# Normalize to owner/repo.git
if [[ "$ORIGIN_URL" =~ ^git@github.com:(.*)$ ]]; then
  PATH_PART="${BASH_REMATCH[1]}"
elif [[ "$ORIGIN_URL" =~ ^https://github.com/(.*)$ ]]; then
  PATH_PART="${BASH_REMATCH[1]}"
else
  echo "Unrecognized remote origin URL: $ORIGIN_URL" >&2
  exit 1
fi

AUTH_URL="https://x-access-token:${TOKEN}@github.com/${PATH_PART}"

# Push current branch to the same branch name on origin
git push "$AUTH_URL" "$BRANCH:$BRANCH"

echo "Pushed branch $BRANCH to origin via HTTPS (token not logged)."

