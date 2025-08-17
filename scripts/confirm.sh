#!/usr/bin/env bash
set -euo pipefail
msg="$*"
read -r -p "⚠ 実行して良いですか？: $msg [y/N] " ans
case "${ans:-}" in
  y|Y|yes|YES) exec bash -lc "$msg";;
  *) echo "キャンセル"; exit 1;;
esac
