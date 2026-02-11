#!/usr/bin/env bash
set -euo pipefail

# QuickRefurbz Deployment Script
# This script runs on the VPS after files are synced

echo "Starting QuickRefurbz deployment..."

# Variables (set by GitHub Actions or defaults)
APP_DIR="${APP_DIR:-/var/www/quickrefurbz}"
SERVICE_NAME="${SERVICE_NAME:-quickrefurbz}"

cd "$APP_DIR"

# Detect deployment mode
DEPLOY_MODE="node_systemd"
if [[ -f "docker-compose.yml" ]] || [[ -f "compose.yml" ]]; then
  DEPLOY_MODE="docker_compose"
fi

echo "Deployment mode: $DEPLOY_MODE"

if [[ "$DEPLOY_MODE" == "docker_compose" ]]; then
  echo "Deploying with Docker Compose..."
  docker compose pull
  docker compose up -d --remove-orphans
  docker compose ps
  echo "Docker Compose deployment complete"

else
  echo "Deploying with Node.js + systemd..."

  # Detect package manager
  if [[ -f "pnpm-lock.yaml" ]]; then
    PKG_MANAGER="pnpm"
    INSTALL_CMD="pnpm install --frozen-lockfile --prod"
  elif [[ -f "yarn.lock" ]]; then
    PKG_MANAGER="yarn"
    INSTALL_CMD="yarn install --frozen-lockfile --production"
  else
    PKG_MANAGER="npm"
    INSTALL_CMD="npm ci --omit=dev"
  fi

  echo "Package manager: $PKG_MANAGER"

  # Build local packages first if they exist
  if [[ -d "packages/database" ]]; then
    echo "Building @quickwms/database package..."
    cd packages/database
    npm ci --omit=dev
    npm run build
    cd ../..
  fi

  if [[ -d "packages/api" ]]; then
    echo "Building @quickwms/api package..."
    cd packages/api
    npm ci --omit=dev
    npm run build
    cd ../..
  fi

  # Install dependencies
  echo "Installing dependencies..."
  $INSTALL_CMD

  # Install frontend dependencies if needed
  if [[ -f "frontend/package.json" ]]; then
    echo "Installing frontend dependencies..."
    cd frontend
    if [[ -f "pnpm-lock.yaml" ]]; then
      pnpm install --frozen-lockfile --prod
    elif [[ -f "yarn.lock" ]]; then
      yarn install --frozen-lockfile --production
    else
      npm ci --omit=dev
    fi
    cd ..
  fi

  # Build if build script exists (already built, but just in case)
  if [[ -f "package.json" ]] && grep -q '"build"' package.json; then
    echo "Ensuring build is up to date..."
    if ! [[ -d "dist" ]] || [[ $(find src -newer dist -type f 2>/dev/null | wc -l) -gt 0 ]]; then
      echo "Running build..."
      npm run build
    else
      echo "Build is up to date"
    fi
  fi

  # Ensure frontend build exists
  if [[ -f "frontend/package.json" ]] && ! [[ -d "frontend/dist" ]]; then
    echo "Building frontend..."
    cd frontend && npm run build && cd ..
  fi

  # Ensure data directory exists
  mkdir -p data

  # Restart systemd service
  echo "Restarting $SERVICE_NAME service..."
  sudo systemctl restart "$SERVICE_NAME"

  # Wait a moment for service to start
  sleep 2

  # Check service status
  echo "Service status:"
  systemctl status "$SERVICE_NAME" --no-pager --lines=10 || true

  # Verify service is running
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Service is running"
  else
    echo "WARNING: Service may not be running properly"
    systemctl status "$SERVICE_NAME" --no-pager || true
    exit 1
  fi
fi

echo ""
echo "Deployment complete!"
echo "Application: QuickRefurbz"
echo "URL: https://quickrefurbz.com"
