#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/algovent-007-price-flex-bulk-price-editor}"
REPO_URL="${REPO_URL:-https://github.com/algovent-007/algovent-007-price-flex-bulk-price-editor.git}"
BRANCH="${BRANCH:-staging}"

echo "==> Installing system packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx git curl

echo "==> Installing Node.js 20 if needed"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Installing PM2 if needed"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Cloning repository"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [ ! -f ".env.staging" ]; then
  echo "ERROR: .env.staging is missing on the server."
  echo "Copy it from your laptop before continuing:"
  echo "scp -i <key.pem> .env.staging ubuntu@<staging-ip>:$APP_DIR/.env.staging"
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Running database migrations"
cp .env.staging .env
npm run setup

echo "==> Building app"
npm run build

echo "==> Configuring nginx"
sudo cp deploy/nginx/priceflex-staging.conf /etc/nginx/sites-available/priceflex-staging
sudo ln -sf /etc/nginx/sites-available/priceflex-staging /etc/nginx/sites-enabled/priceflex-staging
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "==> Starting PM2"
pm2 delete price-flex-staging 2>/dev/null || true
pm2 start ecosystem.staging.config.cjs
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true

echo "==> Staging server setup complete"
echo "App should listen on port 3000 behind nginx at priceflex.algovent.com"
