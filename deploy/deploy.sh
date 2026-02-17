#!/usr/bin/env bash
set -euo pipefail

# QuickRefurbz deploy script
# Run on the server after rsync delivers built artifacts

APP_DIR="/var/www/quickwms/QuickRefurbz"
SERVICE_NAME="quickrefurbz"

echo "==> Deploying $SERVICE_NAME"
echo "    Directory: $APP_DIR"
echo "    Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

cd "$APP_DIR"

# Install production dependencies only
echo "==> Installing production dependencies..."
npm ci --omit=dev

# Restart the PM2 process
echo "==> Restarting PM2 process: $SERVICE_NAME"
pm2 restart "$SERVICE_NAME" --update-env

# Wait a moment for the process to stabilize
sleep 5

# Health check
echo "==> Running health check..."
if curl -sf --max-time 10 http://localhost:3004/api/health; then
  echo ""
  echo "==> Health check passed"
else
  echo ""
  echo "==> ERROR: Health check failed!"
  pm2 logs "$SERVICE_NAME" --lines 20 --nostream
  exit 1
fi

echo "==> Deploy complete"
