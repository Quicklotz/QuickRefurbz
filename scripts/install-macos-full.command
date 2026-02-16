#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# QuickTestz (QuickRefurbz) — Full macOS Installer
# Double-click this .command file or run from Terminal.
###############################################################################

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_NAME="QuickRefurbz"
APP_NAME="QuickTestz"
APP_LABEL="com.quicklotz.quicktestz"
SERVER_PORT=3001

# ── colours / helpers ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

step()  { printf "\n${CYAN}${BOLD}[%s/8]${NC} %s\n" "$1" "$2"; }
ok()    { printf "  ${GREEN}OK${NC} %s\n" "$1"; }
warn()  { printf "  ${YELLOW}WARN${NC} %s\n" "$1"; }
fail()  { printf "  ${RED}FAIL${NC} %s\n" "$1"; exit 1; }

echo ""
echo "============================================="
echo "   ${APP_NAME} — macOS Installer"
echo "   Part of QuickRefurbz by Upscaled"
echo "============================================="
echo ""

# ── detect sudo capability ──────────────────────────────────────────────────
can_sudo=false
if sudo -n true 2>/dev/null; then
  can_sudo=true
fi

###############################################################################
# [1/8] Node.js 20 LTS
###############################################################################
step 1 "Check / install Node.js 20 LTS"

install_node() {
  echo "  Downloading Node.js 20 LTS installer..."
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local pkg_name
  pkg_name="$(curl -fsSL https://nodejs.org/dist/latest-v20.x/ \
    | sed -n 's/.*href="\(node-v[^"]*\.pkg\)".*/\1/p' | head -n 1)"
  if [[ -z "${pkg_name}" ]]; then
    fail "Could not locate Node.js installer package on nodejs.org"
  fi
  local pkg_url="https://nodejs.org/dist/latest-v20.x/${pkg_name}"
  curl -fsSL "${pkg_url}" -o "${tmp_dir}/${pkg_name}"
  echo "  Installing Node.js (may request admin password)..."
  sudo installer -pkg "${tmp_dir}/${pkg_name}" -target /
  rm -rf "${tmp_dir}"
  # Refresh PATH so the rest of the script sees node
  export PATH="/usr/local/bin:${PATH}"
}

if command -v node >/dev/null 2>&1; then
  NODE_VER="$(node -v | sed 's/v//')"
  NODE_MAJOR="${NODE_VER%%.*}"
  if (( NODE_MAJOR >= 20 )); then
    ok "Node.js ${NODE_VER} found"
  else
    warn "Node.js ${NODE_VER} is below v20 — upgrading"
    install_node
    ok "Node.js $(node -v) installed"
  fi
else
  warn "Node.js not found — installing"
  install_node
  ok "Node.js $(node -v) installed"
fi

###############################################################################
# [2/8] Xcode Command-Line Tools
###############################################################################
step 2 "Check / install Xcode Command-Line Tools"

if xcode-select -p >/dev/null 2>&1; then
  ok "Xcode CLI tools already installed"
else
  echo "  Installing Xcode CLI tools (a system dialog may appear)..."
  xcode-select --install 2>/dev/null || true
  echo "  Waiting for Xcode CLI tools installation to complete..."
  until xcode-select -p >/dev/null 2>&1; do
    sleep 5
  done
  ok "Xcode CLI tools installed"
fi

###############################################################################
# [3/8] Clone repo or detect existing install
###############################################################################
step 3 "Detect project directory"

if [[ -f "${REPO_DIR}/package.json" ]]; then
  ok "Project found at ${REPO_DIR}"
else
  fail "package.json not found at ${REPO_DIR}. Please clone the repo first."
fi

cd "${REPO_DIR}"

###############################################################################
# [4/8] Build packages + app + frontend
###############################################################################
step 4 "Install dependencies and build"

echo "  Installing root dependencies..."
npm ci

# Build local workspace packages first
for pkg_dir in packages/database packages/api; do
  if [[ -d "${REPO_DIR}/${pkg_dir}" ]]; then
    echo "  Building ${pkg_dir}..."
    if [[ -f "${REPO_DIR}/${pkg_dir}/package.json" ]]; then
      (cd "${REPO_DIR}/${pkg_dir}" && npm ci 2>/dev/null || npm install && npm run build 2>/dev/null || true)
    fi
  fi
done

echo "  Building TypeScript (npm run build)..."
npm run build
ok "Backend compiled to dist/"

echo "  Building frontend..."
if [[ -d "${REPO_DIR}/frontend" && -f "${REPO_DIR}/frontend/package.json" ]]; then
  (cd "${REPO_DIR}/frontend" && npm ci 2>/dev/null || npm install && npm run build)
  ok "Frontend built"
else
  warn "frontend/ directory not found or missing package.json — skipping"
fi

###############################################################################
# [5/8] Register CLI commands
###############################################################################
step 5 "Register CLI commands (quicktestz, qr-enhanced, qr)"

# Determine bin directory
bin_root="/usr/local/bin"
if [[ -d "/opt/homebrew/bin" ]]; then
  bin_root="/opt/homebrew/bin"
fi
if [[ "${can_sudo}" != "true" ]]; then
  bin_root="${HOME}/.local/bin"
fi

# Map of command-name -> entry-point
declare -A CLI_MAP=(
  ["quicktestz"]="dist/enhanced-cli.js"
  ["qr-enhanced"]="dist/enhanced-cli.js"
  ["qr"]="dist/index.js"
)

create_bin_link() {
  local cmd_name="$1"
  local entry="$2"
  local target_path="${bin_root}/${cmd_name}"
  local script_body
  script_body="$(cat <<BINEOF
#!/usr/bin/env bash
set -euo pipefail
export DB_TYPE=sqlite
exec node "${REPO_DIR}/${entry}" "\$@"
BINEOF
)"

  if [[ "${can_sudo}" == "true" ]]; then
    sudo mkdir -p "${bin_root}"
    echo "${script_body}" | sudo tee "${target_path}" >/dev/null
    sudo chmod +x "${target_path}"
  else
    mkdir -p "${bin_root}"
    echo "${script_body}" > "${target_path}"
    chmod +x "${target_path}"
  fi

  # Always also install in ~/.local/bin as fallback
  mkdir -p "${HOME}/.local/bin"
  cat <<LOCALEOF > "${HOME}/.local/bin/${cmd_name}"
#!/usr/bin/env bash
set -euo pipefail
export DB_TYPE=sqlite
exec node "${REPO_DIR}/${entry}" "\$@"
LOCALEOF
  chmod +x "${HOME}/.local/bin/${cmd_name}"
}

for cmd in "${!CLI_MAP[@]}"; do
  create_bin_link "${cmd}" "${CLI_MAP[${cmd}]}"
  ok "${cmd} -> ${CLI_MAP[${cmd}]}"
done

# Ensure ~/.local/bin is on PATH via .zshrc
if ! grep -q "# QuickTestz PATH" "${HOME}/.zshrc" 2>/dev/null; then
  {
    echo ""
    echo "# QuickTestz PATH"
    echo 'export PATH="${HOME}/.local/bin:${PATH}"'
  } >> "${HOME}/.zshrc"
  ok "Updated ~/.zshrc with PATH"
else
  ok "PATH already configured in ~/.zshrc"
fi

###############################################################################
# [6/8] Create QuickTestz.app via osacompile
###############################################################################
step 6 "Create ${APP_NAME}.app"

# Delegate to create-macos-app.sh if available, otherwise inline
ICON_PATH="${REPO_DIR}/assets/quicktestz-icon.icns"

desktop_app="${HOME}/Desktop/${APP_NAME}.app"
apps_app="/Applications/${APP_NAME}.app"

# AppleScript: start server in background, wait, open browser
app_script="$(mktemp)"
cat <<APPLESCRIPT > "${app_script}"
do shell script "export DB_TYPE=sqlite; cd '${REPO_DIR}' && nohup /usr/local/bin/node dist/server.js > /tmp/quicktestz-server.log 2>&1 &"
delay 2
do shell script "open http://localhost:${SERVER_PORT}"
APPLESCRIPT

rm -rf "${desktop_app}"
osacompile -o "${desktop_app}" "${app_script}"
rm -f "${app_script}"
ok "Created ${desktop_app}"

# Copy to /Applications
if [[ "${can_sudo}" == "true" ]]; then
  rm -rf "${apps_app}"
  sudo cp -R "${desktop_app}" "${apps_app}"
  ok "Copied to ${apps_app}"
else
  mkdir -p "${HOME}/Applications"
  rm -rf "${HOME}/Applications/${APP_NAME}.app"
  cp -R "${desktop_app}" "${HOME}/Applications/${APP_NAME}.app"
  ok "Copied to ~/Applications/${APP_NAME}.app"
fi

# Apply custom icon if present
if [[ -f "${ICON_PATH}" ]]; then
  cp "${ICON_PATH}" "${desktop_app}/Contents/Resources/applet.icns"
  if [[ "${can_sudo}" == "true" ]]; then
    sudo cp "${ICON_PATH}" "${apps_app}/Contents/Resources/applet.icns"
  else
    cp "${ICON_PATH}" "${HOME}/Applications/${APP_NAME}.app/Contents/Resources/applet.icns" 2>/dev/null || true
  fi
  ok "Applied custom icon"
else
  warn "Icon not found at ${ICON_PATH} — using default"
fi

###############################################################################
# [7/8] Configure launchd auto-start
###############################################################################
step 7 "Configure launchd auto-start"

"${REPO_DIR}/scripts/create-launchd-plist.sh" \
  "${APP_LABEL}" \
  "${REPO_DIR}" \
  "${SERVER_PORT}"
ok "LaunchAgent installed at ~/Library/LaunchAgents/${APP_LABEL}.plist"

# Load the agent (unload first if already loaded)
launchctl unload "${HOME}/Library/LaunchAgents/${APP_LABEL}.plist" 2>/dev/null || true
launchctl load "${HOME}/Library/LaunchAgents/${APP_LABEL}.plist"
ok "LaunchAgent loaded"

###############################################################################
# [8/8] Verify installation and open browser
###############################################################################
step 8 "Verify installation"

if [[ -x "${REPO_DIR}/scripts/install-verify.sh" ]]; then
  "${REPO_DIR}/scripts/install-verify.sh" || warn "Some verification checks failed (see above)"
else
  warn "install-verify.sh not found — skipping verification"
fi

# Give the server a moment to start then open the browser
sleep 2
open "http://localhost:${SERVER_PORT}"

echo ""
echo "============================================="
echo "  ${APP_NAME} installation complete!"
echo ""
echo "  Web UI:   http://localhost:${SERVER_PORT}"
echo "  CLI:      quicktestz --help"
echo "  App:      ~/Desktop/${APP_NAME}.app"
echo "============================================="
echo ""
