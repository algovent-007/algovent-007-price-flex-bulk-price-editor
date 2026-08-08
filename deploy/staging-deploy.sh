#!/usr/bin/env bash
set -euo pipefail

# Deploy local code to staging EC2 (priceflex.algovent.com)
# Usage: ./deploy/staging-deploy.sh

STAGING_HOST="${STAGING_HOST:-ubuntu@13.49.231.242}"
STAGING_KEY="${STAGING_KEY:-$HOME/Downloads/shopify-staging-key.pem}"
APP_DIR="${APP_DIR:-~/algovent-007-price-flex-bulk-price-editor}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Syncing code to staging (excluding node_modules, build, env files)"
rsync -az --delete \
  --exclude node_modules \
  --exclude build \
  --exclude .git \
  --exclude .env \
  --exclude '.env.*' \
  -e "ssh -i $STAGING_KEY -o StrictHostKeyChecking=no" \
  "$ROOT_DIR/" "$STAGING_HOST:$APP_DIR/"

echo "==> Building, migrating, and restarting on staging"
ssh -i "$STAGING_KEY" -o StrictHostKeyChecking=no "$STAGING_HOST" <<REMOTE
set -euo pipefail
cd $APP_DIR
npm ci
npx prisma migrate deploy
npm run build
pm2 restart price-flex-staging || pm2 start ecosystem.staging.config.cjs
echo "Billing code in build: \$(grep -c requireSubscription build/server/index.js || true)"
REMOTE

echo "==> Done. Staging app: https://priceflex.algovent.com"
echo "    Uninstall + reinstall the app on your dev store, then select a plan."
