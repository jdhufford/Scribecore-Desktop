#!/usr/bin/env bash
# Build one Windows target with electron-builder. On failure, post the end of the
# log as a GitHub Actions error annotation, since job logs need a signed-in user.
set -uo pipefail
target="$1"
log="package-${target}.log"
npx electron-builder --win "$target" --x64 --publish never 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  msg=$(tail -n 60 "$log" | tr -d '\r' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"} {print}')
  echo "::error title=electron-builder ${target} failed::${msg}"
fi
exit "$status"
