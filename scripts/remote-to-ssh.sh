#!/usr/bin/env bash
set -euo pipefail

# Convert origin remote URL to SSH form if it's HTTPS.

ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
if [[ -z "$ORIGIN_URL" ]]; then
  echo "No origin remote set" >&2
  exit 1
fi

if [[ "$ORIGIN_URL" =~ ^git@github.com:(.*)$ ]]; then
  echo "Origin already uses SSH: $ORIGIN_URL"
  exit 0
fi

if [[ "$ORIGIN_URL" =~ ^https://github.com/(.*)$ ]]; then
  PATH_PART="${BASH_REMATCH[1]}"
  NEW_URL="git@github.com:${PATH_PART}"
  git remote set-url origin "$NEW_URL"
  echo "Updated origin to SSH: $NEW_URL"
  exit 0
fi

echo "Unrecognized origin URL: $ORIGIN_URL" >&2
exit 1

