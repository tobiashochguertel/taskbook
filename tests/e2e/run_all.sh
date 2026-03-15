#!/usr/bin/env bash
# ============================================================================
# E2E Test Runner — Taskbook Server
#
# Usage:
#   ./tests/e2e/run_all.sh [SERVER_URL]
#
# Runs BDD-style E2E tests against a live tb-server instance.
# Default server: https://taskbook.hochguertel.work
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER="${1:-https://taskbook.hochguertel.work}"

# Counters
PASS=0
FAIL=0
SKIP=0
ERRORS=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+="  FAIL: $1\n"; echo -e "  ${RED}✗${NC} $1"; }
skip() { SKIP=$((SKIP + 1)); echo -e "  ${YELLOW}⊘${NC} $1 (skipped)"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# Generate unique test identifiers
TS=$(date +%s)
RAND=$(head -c 4 /dev/urandom | xxd -p)

# Sleep between rate-limited requests (server: 10 req/60s on auth endpoints)
AUTH_DELAY=1

# ============================================================================
section "S10 — Health Endpoint"
# ============================================================================

# AC-S10-1: GET /api/v1/health returns {"status":"ok"}
RESP=$(curl -sf "${SERVER}/api/v1/health" 2>/dev/null || true)
if echo "$RESP" | grep -q '"status":"ok"'; then
  pass "AC-S10-1: GET /api/v1/health returns {\"status\":\"ok\"}"
else
  fail "AC-S10-1: GET /api/v1/health — got: $RESP"
fi

# AC-S10-2: Health endpoint does not require authentication
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVER}/api/v1/health" 2>/dev/null || true)
if [ "$HTTP_CODE" = "200" ]; then
  pass "AC-S10-2: Health endpoint requires no auth (HTTP $HTTP_CODE)"
else
  fail "AC-S10-2: Health endpoint returned HTTP $HTTP_CODE instead of 200"
fi

# ============================================================================
section "S7 — Root Path Does Not Trigger OIDC Error"
# ============================================================================

# AC-S7-1: GET / returns HTTP 200 or 302, not an Authelia error
ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVER}/" 2>/dev/null || true)
if [ "$ROOT_CODE" = "200" ] || [ "$ROOT_CODE" = "302" ]; then
  pass "AC-S7-1: GET / returns HTTP $ROOT_CODE (not an OIDC error)"
else
  fail "AC-S7-1: GET / returned HTTP $ROOT_CODE"
fi

# AC-S7-2: Response is valid JSON or HTML, not error
ROOT_BODY=$(curl -sL "${SERVER}/" 2>/dev/null || true)
if echo "$ROOT_BODY" | grep -q "consent/completion?error=invalid_request"; then
  fail "AC-S7-2: GET / shows Authelia OIDC error page"
elif echo "$ROOT_BODY" | grep -q '"service"'; then
  pass "AC-S7-2: GET / returns valid JSON info page"
elif echo "$ROOT_BODY" | grep -q '<html'; then
  pass "AC-S7-2: GET / returns valid HTML page"
else
  # Might be Authelia login redirect for unauthenticated users — that's OK
  if [ "$ROOT_CODE" = "302" ]; then
    pass "AC-S7-2: GET / redirects (no OIDC error)"
  else
    fail "AC-S7-2: GET / returned unexpected response"
  fi
fi

# AC-S7-3: No redirect_uri mismatch in redirect Location header
ROOT_HEADERS=$(curl -sv "${SERVER}/" 2>&1 || true)
if echo "$ROOT_HEADERS" | grep -i "location:" | grep -q "redirect_uri=.*taskbook.hochguertel.work/$"; then
  fail "AC-S7-3: GET / has Location with redirect_uri pointing to /"
else
  pass "AC-S7-3: GET / does not trigger redirect_uri=/ to Authelia"
fi

# ============================================================================
section "S9 — Unauthenticated API Access"
# ============================================================================

# AC-S9-1: Protected endpoints return 401 without token
for endpoint in "/api/v1/items" "/api/v1/me"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SERVER}${endpoint}" 2>/dev/null || true)
  if [ "$CODE" = "401" ]; then
    pass "AC-S9-1: GET ${endpoint} without token returns 401"
  else
    fail "AC-S9-1: GET ${endpoint} without token returned $CODE (expected 401)"
  fi
done

# ============================================================================
section "S1 — Basic Registration and Login"
# ============================================================================

TEST_USER="testuser_${TS}_${RAND}"
TEST_EMAIL="${TEST_USER}@example.com"
TEST_PASS="SecureTestPass_${RAND}"

# AC-S1-1: Register returns 200 and token
sleep $AUTH_DELAY
REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "${SERVER}/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}" 2>/dev/null || true)
REG_CODE=$(echo "$REG_RESP" | tail -1)
REG_BODY=$(echo "$REG_RESP" | head -n -1)
REG_TOKEN=$(echo "$REG_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

if [ "$REG_CODE" = "200" ] && [ -n "$REG_TOKEN" ]; then
  pass "AC-S1-1: POST /api/v1/register returns 200 with token"
else
  fail "AC-S1-1: Register returned HTTP $REG_CODE — body: $REG_BODY"
fi

# AC-S1-2: Login returns 200 and token
sleep $AUTH_DELAY
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "${SERVER}/api/v1/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"${TEST_PASS}\"}" 2>/dev/null || true)
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | head -n -1)
LOGIN_TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

if [ "$LOGIN_CODE" = "200" ] && [ -n "$LOGIN_TOKEN" ]; then
  pass "AC-S1-2: POST /api/v1/login returns 200 with token"
else
  fail "AC-S1-2: Login returned HTTP $LOGIN_CODE — body: $LOGIN_BODY"
fi

# AC-S1-3: Wrong password returns 401
sleep $AUTH_DELAY
WRONG_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVER}/api/v1/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"WrongPassword123\"}" 2>/dev/null || true)
if [ "$WRONG_RESP" = "401" ]; then
  pass "AC-S1-3: Login with wrong password returns 401"
else
  fail "AC-S1-3: Wrong password returned HTTP $WRONG_RESP (expected 401)"
fi

# ============================================================================
section "S2 — Passwords with Special Characters"
# ============================================================================

SPECIAL_USER="special_${TS}_${RAND}"
SPECIAL_EMAIL="${SPECIAL_USER}@example.com"
SPECIAL_PASS='6S1%4Y#VB@LKKf3kanx%04J1'

# AC-S2-1: Special character password accepted
sleep $AUTH_DELAY
SPEC_RESP=$(curl -s -w "\n%{http_code}" -X POST "${SERVER}/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${SPECIAL_USER}\",\"email\":\"${SPECIAL_EMAIL}\",\"password\":\"${SPECIAL_PASS}\"}" 2>/dev/null || true)
SPEC_CODE=$(echo "$SPEC_RESP" | tail -1)

if [ "$SPEC_CODE" = "200" ]; then
  pass "AC-S2-1: Registration with special chars password succeeds (HTTP 200)"
else
  fail "AC-S2-1: Special chars password registration returned $SPEC_CODE"
fi

# Login with special char password
sleep $AUTH_DELAY
SPEC_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVER}/api/v1/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${SPECIAL_USER}\",\"password\":\"${SPECIAL_PASS}\"}" 2>/dev/null || true)
if [ "$SPEC_LOGIN" = "200" ]; then
  pass "AC-S2-1: Login with special chars password succeeds (HTTP 200)"
else
  fail "AC-S2-1: Login with special chars password returned $SPEC_LOGIN"
fi

# AC-S2-2: Short password rejected
sleep $AUTH_DELAY
SHORT_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVER}/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"shortpw_${RAND}\",\"email\":\"shortpw_${RAND}@example.com\",\"password\":\"12345\"}" 2>/dev/null || true)
if [ "$SHORT_RESP" = "400" ]; then
  pass "AC-S2-2: Short password (< 8 chars) rejected with 400"
else
  fail "AC-S2-2: Short password returned HTTP $SHORT_RESP (expected 400)"
fi

# ============================================================================
section "S3 — Email Address as Username"
# ============================================================================

# AC-S3-1: Username with dots accepted (requires PR #1 / feat/password-allow-all-printable-chars)
DOT_USER="alice.smith_${RAND}"
sleep $AUTH_DELAY
DOT_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVER}/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${DOT_USER}\",\"email\":\"${DOT_USER}@example.com\",\"password\":\"SecurePass123\"}" 2>/dev/null || true)
if [ "$DOT_RESP" = "200" ]; then
  pass "AC-S3-1: Username with dots accepted (HTTP 200)"
elif [ "$DOT_RESP" = "400" ]; then
  fail "AC-S3-1: Username with dots rejected (HTTP 400) — requires PR #1 merge"
else
  fail "AC-S3-1: Username with dots returned HTTP $DOT_RESP"
fi

# AC-S3-2: Username with spaces rejected
sleep $AUTH_DELAY
SPACE_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SERVER}/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice smith\",\"email\":\"space_${RAND}@example.com\",\"password\":\"SecurePass123\"}" 2>/dev/null || true)
if [ "$SPACE_RESP" = "400" ]; then
  pass "AC-S3-2: Username with space rejected (HTTP 400)"
else
  fail "AC-S3-2: Username with space returned HTTP $SPACE_RESP (expected 400)"
fi

# ============================================================================
section "S8 — Task Sync Round-Trip"
# ============================================================================

if [ -n "${LOGIN_TOKEN:-}" ]; then
  # AC-S8-1: PUT /api/v1/items with valid token accepts data
  ITEM_DATA=$(echo -n "test-item-data" | base64)
  ITEM_NONCE=$(echo -n "testnonce123" | base64)
  PUT_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${SERVER}/api/v1/items" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${LOGIN_TOKEN}" \
    -d "{\"items\":{\"test-key-${RAND}\":{\"data\":\"${ITEM_DATA}\",\"nonce\":\"${ITEM_NONCE}\"}}}" 2>/dev/null || true)
  if [ "$PUT_RESP" = "200" ]; then
    pass "AC-S8-1: PUT /api/v1/items with valid token returns 200"
  else
    fail "AC-S8-1: PUT /api/v1/items returned HTTP $PUT_RESP"
  fi

  # AC-S8-2: GET /api/v1/items returns stored items
  GET_ITEMS=$(curl -s "${SERVER}/api/v1/items" \
    -H "Authorization: Bearer ${LOGIN_TOKEN}" 2>/dev/null || true)
  if echo "$GET_ITEMS" | grep -q "test-key-${RAND}"; then
    pass "AC-S8-2: GET /api/v1/items returns previously stored item"
  else
    fail "AC-S8-2: GET /api/v1/items did not contain test item — got: ${GET_ITEMS:0:200}"
  fi

  # AC-S8-3: Items from user A not visible to user B
  USER_B="userb_${TS}_${RAND}"
  REGB=$(curl -s -X POST "${SERVER}/api/v1/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${USER_B}\",\"email\":\"${USER_B}@example.com\",\"password\":\"SecurePass123\"}" 2>/dev/null || true)
  TOKEN_B=$(echo "$REGB" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

  if [ -n "$TOKEN_B" ]; then
    ITEMS_B=$(curl -s "${SERVER}/api/v1/items" \
      -H "Authorization: Bearer ${TOKEN_B}" 2>/dev/null || true)
    if echo "$ITEMS_B" | grep -q "test-key-${RAND}"; then
      fail "AC-S8-3: User B can see User A's items (isolation broken)"
    else
      pass "AC-S8-3: User B cannot see User A's items (data isolation OK)"
    fi
  else
    skip "AC-S8-3: Could not register user B"
  fi
else
  skip "AC-S8-1: No login token available"
  skip "AC-S8-2: No login token available"
  skip "AC-S8-3: No login token available"
fi

# ============================================================================
section "S4 — OIDC Login Happy Path"
# ============================================================================

# AC-S4-1: GET /auth/oidc/login redirects to Authelia
OIDC_HEADERS=$(curl -sv "${SERVER}/auth/oidc/login" 2>&1 || true)
OIDC_CODE=$(echo "$OIDC_HEADERS" | grep -o "< HTTP/[0-9.]* [0-9]*" | grep -o '[0-9]*$' || true)
OIDC_LOCATION=$(echo "$OIDC_HEADERS" | grep -i "< location:" | head -1 || true)

if [ "$OIDC_CODE" = "303" ] || [ "$OIDC_CODE" = "302" ] || [ "$OIDC_CODE" = "307" ]; then
  if echo "$OIDC_LOCATION" | grep -qi "auth.hochguertel.work"; then
    pass "AC-S4-1: GET /auth/oidc/login redirects to Authelia (HTTP $OIDC_CODE)"
  else
    fail "AC-S4-1: Redirect does not point to Authelia: $OIDC_LOCATION"
  fi
else
  if [ "$OIDC_CODE" = "200" ]; then
    pass "AC-S4-1: GET /auth/oidc/login returns 200 (OIDC session already exists)"
  else
    fail "AC-S4-1: GET /auth/oidc/login returned HTTP $OIDC_CODE (expected 302/303/307)"
  fi
fi

# AC-S4-6: No scope= inside the redirect_uri parameter value itself
# (scope= as a sibling query param is expected; only check if it leaks INTO redirect_uri)
REDIR_URI_VALUE=$(echo "$OIDC_LOCATION" | grep -oP 'redirect_uri=[^&]*' | head -1 || true)
if echo "$REDIR_URI_VALUE" | grep -q "scope%3D\|scope=.*scope="; then
  fail "AC-S4-6: redirect_uri value contains scope= parameter"
else
  pass "AC-S4-6: redirect_uri value is clean (no scope= inside it)"
fi

# AC-S4-2 through AC-S4-5 require interactive browser flow — skip in headless mode
skip "AC-S4-2: OIDC callback completion (requires browser)"
skip "AC-S4-3: HTML response with session-token (requires browser)"
skip "AC-S4-4: Bearer token from OIDC accepted by API (requires browser)"
skip "AC-S4-5: No invalid_grant errors (requires Authelia log access)"

# ============================================================================
section "S5/S6 — OIDC User Auto-Creation & Re-Login"
# ============================================================================
skip "AC-S5-1: First OIDC login creates user (requires browser)"
skip "AC-S5-2: oidc_identities row created (requires browser + DB access)"
skip "AC-S5-3: Encryption key shown on first login (requires browser)"
skip "AC-S5-4: No duplicate on re-login (requires browser)"
skip "AC-S6-1: Re-login no duplicate users (requires browser)"
skip "AC-S6-2: No encryption key on re-login (requires browser)"
skip "AC-S6-3: Re-login token valid (requires browser)"

# ============================================================================
# Authenticated endpoint: GET /api/v1/me
# ============================================================================
section "Bonus — GET /api/v1/me"

if [ -n "${LOGIN_TOKEN:-}" ]; then
  ME_RESP=$(curl -s "${SERVER}/api/v1/me" \
    -H "Authorization: Bearer ${LOGIN_TOKEN}" 2>/dev/null || true)
  if echo "$ME_RESP" | grep -q "\"username\":\"${TEST_USER}\""; then
    pass "GET /api/v1/me returns correct username"
  else
    fail "GET /api/v1/me returned: $ME_RESP"
  fi
  if echo "$ME_RESP" | grep -q "\"email\":\"${TEST_EMAIL}\""; then
    pass "GET /api/v1/me returns correct email"
  else
    fail "GET /api/v1/me returned: $ME_RESP"
  fi
else
  skip "GET /api/v1/me (no token)"
fi

# ============================================================================
section "T5/T6 — Token Import & Token-Only Login (CLI)"
# ============================================================================

# These tests use the REST API token obtained from registration above.
# They verify the --set-token and --login --token CLI flags work correctly.

if [ -n "${LOGIN_TOKEN:-}" ] && command -v tb &>/dev/null; then
  # Backup existing credentials if any
  CRED_FILE="$HOME/.taskbook/credentials.json"
  CRED_BACKUP=""
  if [ -f "$CRED_FILE" ]; then
    CRED_BACKUP=$(cat "$CRED_FILE")
  fi

  # AC-T5-1: tb --set-token saves credentials without prompting
  TB_OUT=$(tb --set-token --server "${SERVER}" --token "${LOGIN_TOKEN}" --key "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTEy" 2>&1 || true)
  if [ -f "$CRED_FILE" ]; then
    SAVED_TOKEN=$(grep -o '"token":"[^"]*"' "$CRED_FILE" | head -1 | cut -d'"' -f4)
    if [ "$SAVED_TOKEN" = "$LOGIN_TOKEN" ]; then
      pass "AC-T5-1: --set-token saves token to credentials file"
    else
      fail "AC-T5-1: saved token mismatch (expected ${LOGIN_TOKEN:0:8}…, got ${SAVED_TOKEN:0:8}…)"
    fi
  else
    fail "AC-T5-1: credentials file not created"
  fi

  # AC-T5-2: After set-token, check that tb --status shows sync enabled
  STATUS_OUT=$(tb --status 2>&1 || true)
  if echo "$STATUS_OUT" | grep -qi "remote\|enabled\|sync"; then
    pass "AC-T5-2: tb --status shows sync enabled after --set-token"
  else
    fail "AC-T5-2: tb --status output: $STATUS_OUT"
  fi

  # Clean up for next test
  rm -f "$CRED_FILE"

  # AC-T6-1: tb --login --token saves credentials without password prompt
  sleep "$AUTH_DELAY"
  TB_LOGIN_OUT=$(tb --login --server "${SERVER}" --token "${LOGIN_TOKEN}" --key "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTEy" 2>&1 || true)
  if [ -f "$CRED_FILE" ]; then
    SAVED_TOKEN2=$(grep -o '"token":"[^"]*"' "$CRED_FILE" | head -1 | cut -d'"' -f4)
    if [ "$SAVED_TOKEN2" = "$LOGIN_TOKEN" ]; then
      pass "AC-T6-1: --login --token saves credentials"
    else
      fail "AC-T6-1: saved token mismatch"
    fi
  else
    fail "AC-T6-1: credentials file not created"
  fi

  # AC-T6-2: The command did not prompt for password (non-interactive)
  if echo "$TB_LOGIN_OUT" | grep -qi "password:"; then
    fail "AC-T6-2: --login --token prompted for password"
  else
    pass "AC-T6-2: --login --token did not prompt for password"
  fi

  # Restore original credentials
  if [ -n "$CRED_BACKUP" ]; then
    mkdir -p "$(dirname "$CRED_FILE")"
    echo "$CRED_BACKUP" > "$CRED_FILE"
    chmod 600 "$CRED_FILE"
  else
    rm -f "$CRED_FILE"
  fi
else
  if [ -z "${LOGIN_TOKEN:-}" ]; then
    skip "AC-T5/T6: no login token available"
  else
    skip "AC-T5/T6: tb CLI not found in PATH"
  fi
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${CYAN}━━━ Results ━━━${NC}"
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${RED}Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Failures:${NC}"
  echo -e "$ERRORS"
  exit 1
else
  echo -e "${GREEN}All executable tests passed!${NC}"
  exit 0
fi
