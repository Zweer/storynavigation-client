#!/usr/bin/env bash
# Byparr fire-test against StoryNavigation's Cloudflare managed challenge.
#
# Prerequisite: Byparr running and reachable at $BYPARR_URL (default 8191):
#   docker compose -f docker-compose.byparr.yml up -d
#
# Usage:
#   ./scripts/byparr-probe.sh [username]
# Example:
#   ./scripts/byparr-probe.sh heyjoanar
#
# What it does:
#   1. Asks Byparr to GET https://storynavigation.com/user/<username>.
#   2. Byparr runs a stealth browser, tries to solve the CF challenge, and
#      returns resolved HTML + cookies.
#   3. We inspect the result: did we get a `cf_clearance` cookie (= challenge
#      cleared) or is it still the "Just a moment..." interstitial (= failed)?

set -euo pipefail

USERNAME="${1:-heyjoanar}"
BYPARR_URL="${BYPARR_URL:-http://localhost:8191}"
TARGET="https://storynavigation.com/user/${USERNAME}"

echo "=== Byparr probe ==="
echo "Byparr:  ${BYPARR_URL}"
echo "Target:  ${TARGET}"
echo

# 1) Health check — is Byparr reachable?
if ! curl -sS --max-time 10 "${BYPARR_URL}/docs" -o /dev/null; then
  echo "ERROR: Byparr is not reachable at ${BYPARR_URL}."
  echo "Start it with: docker compose -f docker-compose.byparr.yml up -d"
  exit 1
fi
echo "Byparr is up."
echo

# 2) Ask Byparr to solve the challenge (FlareSolverr-compatible API).
echo "Requesting challenge solve (this can take 10-60s)..."
RESP="$(curl -sS --max-time 120 -X POST "${BYPARR_URL}/v1" \
  -H 'Content-Type: application/json' \
  --data "$(printf '{"cmd":"request.get","url":"%s","maxTimeout":90000}' "${TARGET}")")"

echo
echo "=== Raw Byparr response (truncated) ==="
echo "${RESP}" | head -c 1200
echo
echo

# 3) Verdict.
STATUS="$(printf '%s' "${RESP}" | python3 -c 'import sys,json;
try:
    d=json.load(sys.stdin); print(d.get("status",""))
except Exception: print("")' 2>/dev/null || true)"

HAS_CLEARANCE="$(printf '%s' "${RESP}" | grep -c 'cf_clearance' || true)"
STILL_CHALLENGED="$(printf '%s' "${RESP}" | grep -c 'Just a moment' || true)"

echo "=== Verdict ==="
echo "Byparr status field:   ${STATUS:-<none>}"
echo "cf_clearance present:  $([ "${HAS_CLEARANCE}" -gt 0 ] && echo YES || echo NO)"
echo "Still 'Just a moment': $([ "${STILL_CHALLENGED}" -gt 0 ] && echo YES || echo NO)"
echo
if [ "${HAS_CLEARANCE}" -gt 0 ] && [ "${STILL_CHALLENGED}" -eq 0 ]; then
  echo "RESULT: ✅ Challenge CLEARED — Byparr got a cf_clearance cookie."
  echo "        Next: feed these cookies/UA into the POST endpoints and re-verify the API."
else
  echo "RESULT: ❌ Challenge NOT cleared — StoryNavigation's managed challenge held."
  echo "        Byparr (datacenter IP) is likely not enough for this site."
fi
