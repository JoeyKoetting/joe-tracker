#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OLD_PID="${1:-}"
LOG="$ROOT/data/update.log"
mkdir -p "$ROOT/data"
exec >>"$LOG" 2>&1
printf '\n[%s] Starting app update.\n' "$(date -u +%FT%TZ)"

cd "$ROOT"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  printf '[%s] Local changes appeared before restart; leaving the app running.\n' "$(date -u +%FT%TZ)"
  exit 1
fi

start_app() {
  cd "$ROOT"
  nohup bash -c 'cd "$1" && pnpm run migrate && exec pnpm run dev' _ "$ROOT" >>"$LOG" 2>&1 </dev/null &
}

# Give this detached updater time to start before stopping the server that launched it.
sleep 1
if [[ "$OLD_PID" =~ ^[0-9]+$ ]] && kill -0 "$OLD_PID" 2>/dev/null; then
  kill -TERM "$OLD_PID" 2>/dev/null || true
  for _ in {1..20}; do
    kill -0 "$OLD_PID" 2>/dev/null || break
    sleep 0.5
  done
fi

BEFORE="$(git rev-parse HEAD 2>/dev/null || true)"
if ! git pull --ff-only; then
  printf '[%s] Fast-forward update failed; restarting the current version.\n' "$(date -u +%FT%TZ)"
  start_app
  exit 1
fi

if [[ -n "$BEFORE" ]] && git diff-tree --no-commit-id --name-only -r "$BEFORE..HEAD" | grep -Eq '(^|/)(pnpm-lock\.yaml|package\.json)$'; then
  if ! pnpm install --frozen-lockfile; then
    printf '[%s] Dependency installation failed; restarting with available dependencies.\n' "$(date -u +%FT%TZ)"
    start_app
    exit 1
  fi
fi

if ! pnpm run migrate; then
  printf '[%s] Migration failed; restarting the updated app for inspection.\n' "$(date -u +%FT%TZ)"
  start_app
  exit 1
fi

printf '[%s] Update complete; starting JOE Tracker.\n' "$(date -u +%FT%TZ)"
cd "$ROOT"
nohup pnpm run dev >>"$LOG" 2>&1 </dev/null &
