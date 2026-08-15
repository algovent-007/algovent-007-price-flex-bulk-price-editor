#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.staging}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1090
  source .env
  set +a
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is not set in ${ENV_FILE} or .env" >&2
  exit 1
fi

PORT="${PORT:-3000}"
curl -sf \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:${PORT}/internal/cron/process-due-tasks"
