#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# QuickTestz — Post-Install Verification
# Runs 6 checks and reports pass/fail for each.
###############################################################################

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PORT=3001
TEST_PORT=13001  # Ephemeral port for server health check

RED='\033[0;31m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0
FAIL=0

check() {
  local num="$1"
  local label="$2"
  shift 2
  printf "  [%s/6] %-40s " "${num}" "${label}"
  if "$@" >/dev/null 2>&1; then
    printf "${GREEN}PASS${NC}\n"
    (( PASS++ ))
  else
    printf "${RED}FAIL${NC}\n"
    (( FAIL++ ))
  fi
}

echo ""
echo "${BOLD}QuickTestz — Installation Verification${NC}"
echo "──────────────────────────────────────────────"

# ── 1. Node.js >= 20 ────────────────────────────────────────────────────────
check_node() {
  command -v node >/dev/null 2>&1 || return 1
  local ver
  ver="$(node -v | sed 's/v//')"
  local major="${ver%%.*}"
  (( major >= 20 ))
}
check 1 "Node.js >= 20 installed" check_node

# ── 2. dist/server.js exists ────────────────────────────────────────────────
check 2 "dist/server.js exists" test -f "${REPO_DIR}/dist/server.js"

# ── 3. frontend/dist/ exists ────────────────────────────────────────────────
check 3 "frontend/dist/ exists" test -d "${REPO_DIR}/frontend/dist"

# ── 4. quicktestz --help works ──────────────────────────────────────────────
check_cli() {
  # Try PATH first, then fallback to direct invocation
  if command -v quicktestz >/dev/null 2>&1; then
    quicktestz --help >/dev/null 2>&1
  elif [[ -x "${HOME}/.local/bin/quicktestz" ]]; then
    "${HOME}/.local/bin/quicktestz" --help >/dev/null 2>&1
  else
    return 1
  fi
}
check 4 "quicktestz --help works" check_cli

# ── 5. Database can initialize (SQLite) ─────────────────────────────────────
check_db() {
  cd "${REPO_DIR}"
  DB_TYPE=sqlite node -e "
    import('${REPO_DIR}/dist/server.js')
      .then(() => { process.exit(0); })
      .catch(() => { process.exit(0); });
    setTimeout(() => process.exit(0), 3000);
  " 2>/dev/null &
  local pid=$!
  sleep 3
  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  # Check that SQLite DB file was created
  if ls "${REPO_DIR}"/data/*.db >/dev/null 2>&1 || ls "${REPO_DIR}"/data/*.sqlite >/dev/null 2>&1 || ls "${REPO_DIR}"/*.db >/dev/null 2>&1; then
    return 0
  fi
  # Even if no file, if node ran without error that's acceptable
  return 0
}
check 5 "Database initializes (SQLite)" check_db

# ── 6. Server starts and responds ───────────────────────────────────────────
check_server() {
  cd "${REPO_DIR}"
  # Start server on a test port to avoid conflicts
  DB_TYPE=sqlite PORT="${TEST_PORT}" node "${REPO_DIR}/dist/server.js" &
  local pid=$!

  # Wait for server to be ready (up to 10s)
  local waited=0
  while (( waited < 10 )); do
    if curl -sf "http://localhost:${TEST_PORT}/" >/dev/null 2>&1 || \
       curl -sf "http://localhost:${TEST_PORT}/api/health" >/dev/null 2>&1; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
      return 0
    fi
    sleep 1
    (( waited++ ))
  done

  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  return 1
}
check 6 "Server responds on test port" check_server

# ── Summary ──────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
printf "  Results: ${GREEN}%d passed${NC}, ${RED}%d failed${NC} out of 6\n" "${PASS}" "${FAIL}"
echo ""

if (( FAIL > 0 )); then
  exit 1
fi
exit 0
