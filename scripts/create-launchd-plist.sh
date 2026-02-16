#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# create-launchd-plist.sh — Create a launchd plist for QuickTestz auto-start
#
# Usage:
#   ./create-launchd-plist.sh [LABEL] [INSTALL_DIR] [PORT]
#
# Arguments:
#   LABEL       — launchd label (default: com.quicklotz.quicktestz)
#   INSTALL_DIR — Absolute path to the project root (default: parent of scripts/)
#   PORT        — Server port (default: 3001)
#
# Outputs:
#   ~/Library/LaunchAgents/<LABEL>.plist
###############################################################################

LABEL="${1:-com.quicklotz.quicktestz}"
INSTALL_DIR="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${3:-3001}"

PLIST_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/${LABEL}"
NODE_PATH="$(command -v node 2>/dev/null || echo "/usr/local/bin/node")"

# Validate
if [[ ! -f "${INSTALL_DIR}/dist/server.js" ]]; then
  echo "ERROR: ${INSTALL_DIR}/dist/server.js not found. Build the project first."
  exit 1
fi

# Ensure directories exist
mkdir -p "${PLIST_DIR}"
mkdir -p "${LOG_DIR}"

# Unload existing plist if present
if launchctl list "${LABEL}" >/dev/null 2>&1; then
  launchctl unload "${PLIST_PATH}" 2>/dev/null || true
fi

# Write plist
cat <<PLIST > "${PLIST_PATH}"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${INSTALL_DIR}/dist/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>DB_TYPE</key>
    <string>sqlite</string>
    <key>PORT</key>
    <string>${PORT}</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/stderr.log</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>SoftResourceLimits</key>
  <dict>
    <key>NumberOfFiles</key>
    <integer>4096</integer>
  </dict>
</dict>
</plist>
PLIST

echo "Created ${PLIST_PATH}"
echo ""
echo "To manage the service:"
echo "  Load:    launchctl load ${PLIST_PATH}"
echo "  Unload:  launchctl unload ${PLIST_PATH}"
echo "  Status:  launchctl list | grep ${LABEL}"
echo "  Logs:    tail -f ${LOG_DIR}/stdout.log"
