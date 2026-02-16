#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# create-macos-app.sh — Create a .app wrapper via osacompile
#
# Usage:
#   ./create-macos-app.sh <APP_NAME> <INSTALL_DIR> [ICON_PATH]
#
# Arguments:
#   APP_NAME    — Name of the .app (e.g. "QuickTestz")
#   INSTALL_DIR — Absolute path to the project root
#   ICON_PATH   — (Optional) Absolute path to an .icns icon file
#
# Outputs:
#   ~/Desktop/<APP_NAME>.app
#   /Applications/<APP_NAME>.app (or ~/Applications/ if no sudo)
###############################################################################

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <APP_NAME> <INSTALL_DIR> [ICON_PATH]"
  echo ""
  echo "  APP_NAME    — Name for the .app bundle"
  echo "  INSTALL_DIR — Project root (contains dist/server.js)"
  echo "  ICON_PATH   — Optional path to .icns icon"
  exit 1
fi

APP_NAME="$1"
INSTALL_DIR="$2"
ICON_PATH="${3:-}"
SERVER_PORT="${4:-3001}"

# Validate install dir
if [[ ! -f "${INSTALL_DIR}/dist/server.js" ]]; then
  echo "ERROR: ${INSTALL_DIR}/dist/server.js not found. Build the project first."
  exit 1
fi

# Detect sudo
can_sudo=false
if sudo -n true 2>/dev/null; then
  can_sudo=true
fi

desktop_app="${HOME}/Desktop/${APP_NAME}.app"
apps_app="/Applications/${APP_NAME}.app"

# Generate AppleScript that starts the server and opens Safari
app_script="$(mktemp)"
cat <<APPLESCRIPT > "${app_script}"
do shell script "export DB_TYPE=sqlite; cd '${INSTALL_DIR}' && nohup /usr/local/bin/node dist/server.js > /tmp/quicktestz-server.log 2>&1 &"
delay 2
do shell script "open http://localhost:${SERVER_PORT}"
APPLESCRIPT

# Build .app on Desktop
rm -rf "${desktop_app}"
osacompile -o "${desktop_app}" "${app_script}"
rm -f "${app_script}"
echo "Created ${desktop_app}"

# Copy to /Applications
if [[ "${can_sudo}" == "true" ]]; then
  rm -rf "${apps_app}"
  sudo cp -R "${desktop_app}" "${apps_app}"
  echo "Copied to ${apps_app}"
else
  mkdir -p "${HOME}/Applications"
  rm -rf "${HOME}/Applications/${APP_NAME}.app"
  cp -R "${desktop_app}" "${HOME}/Applications/${APP_NAME}.app"
  echo "Copied to ~/Applications/${APP_NAME}.app"
fi

# Apply custom icon
if [[ -n "${ICON_PATH}" && -f "${ICON_PATH}" ]]; then
  cp "${ICON_PATH}" "${desktop_app}/Contents/Resources/applet.icns"
  if [[ "${can_sudo}" == "true" ]]; then
    sudo cp "${ICON_PATH}" "${apps_app}/Contents/Resources/applet.icns"
  else
    cp "${ICON_PATH}" "${HOME}/Applications/${APP_NAME}.app/Contents/Resources/applet.icns" 2>/dev/null || true
  fi
  echo "Applied icon from ${ICON_PATH}"
else
  if [[ -n "${ICON_PATH}" ]]; then
    echo "WARNING: Icon not found at ${ICON_PATH} — using default"
  fi
fi

# Touch to refresh Finder icon cache
touch "${desktop_app}"
if [[ "${can_sudo}" == "true" ]]; then
  sudo touch "${apps_app}" 2>/dev/null || true
fi

echo ""
echo "${APP_NAME}.app created successfully."
echo "  Desktop: ${desktop_app}"
if [[ "${can_sudo}" == "true" ]]; then
  echo "  Applications: ${apps_app}"
else
  echo "  Applications: ~/Applications/${APP_NAME}.app"
fi
