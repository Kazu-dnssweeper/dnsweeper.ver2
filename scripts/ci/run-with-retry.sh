#!/usr/bin/env bash
set -euo pipefail

# Run a command with up to N retries on failure.
# Usage: run-with-retry.sh [max_attempts] [sleep_sec] -- <command...>

MAX=${1:-2}
SLEEP=${2:-3}
shift || true
shift || true
if [[ "${1:-}" != "--" ]]; then
  echo "Usage: $0 [max_attempts] [sleep_sec] -- <command...>" >&2
  exit 2
fi
shift

ATTEMPT=1
until "$@"; do
  EC=$?
  if (( ATTEMPT >= MAX )); then
    echo "Command failed after ${ATTEMPT} attempt(s): $* (exit $EC)" >&2
    exit $EC
  fi
  echo "Attempt ${ATTEMPT} failed (exit $EC). Retrying in ${SLEEP}s..." >&2
  ATTEMPT=$((ATTEMPT+1))
  sleep "$SLEEP"
done

