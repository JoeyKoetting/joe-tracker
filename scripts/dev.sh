#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pnpm run migrate
echo "Starting joe-tracker (apps/web) at http://localhost:4321"
pnpm run dev
