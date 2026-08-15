#!/usr/bin/env bash
set -euo pipefail

# Install a per-minute cron job on staging EC2 to process due scheduled tasks.
# Requires CRON_SECRET in ~/algovent-007-price-flex-bulk-price-editor/.env.staging

APP_DIR="${APP_DIR:-$HOME/algovent-007-price-flex-bulk-price-editor}"
CRON_LINE="* * * * * cd ${APP_DIR} && ENV_FILE=.env.staging bash scripts/process-due-tasks-cron.sh >> ${APP_DIR}/logs/cron-process-due-tasks.log 2>&1"

mkdir -p "${APP_DIR}/logs"

if ! grep -Fq "process-due-tasks-cron.sh" "${APP_DIR}/logs/cron-install.marker" 2>/dev/null; then
  {
    (crontab -l 2>/dev/null || true) | grep -Fv "process-due-tasks-cron.sh" || true
    echo "${CRON_LINE}"
  } | crontab -
  echo "installed $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "${APP_DIR}/logs/cron-install.marker"
  echo "Cron installed: ${CRON_LINE}"
else
  echo "Cron entry already installed"
fi
