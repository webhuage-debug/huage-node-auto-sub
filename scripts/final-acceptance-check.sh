#!/usr/bin/env bash
set -u

LOCAL_BASE_URL="${LOCAL_BASE_URL:-http://127.0.0.1:3000}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://get.huage.us}"
PROBE_CODE="${PROBE_CODE:-__final_acceptance_probe__}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-12}"

failures=0

pass() {
  printf '[PASS] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  failures=$((failures + 1))
}

http_code() {
  curl -k -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$1" 2>/dev/null || printf '000'
}

head_code() {
  curl -k -sS -I -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$1" 2>/dev/null || printf '000'
}

body_get() {
  curl -k -sS --max-time "$TIMEOUT_SECONDS" "$1" 2>/dev/null || true
}

body_post_json() {
  curl -k -sS --max-time "$TIMEOUT_SECONDS" \
    -H 'Content-Type: application/json' \
    -d "$2" \
    "$1" 2>/dev/null || true
}

printf 'Huage Node Auto Sub final acceptance check\n'
printf 'Local base: %s\n' "$LOCAL_BASE_URL"
printf 'Public base: %s\n' "$PUBLIC_BASE_URL"
printf 'This script is read-only and does not print subscription tokens.\n\n'

status_body="$(body_get "$LOCAL_BASE_URL/api/status")"
if printf '%s' "$status_body" | grep -q '"version"[[:space:]]*:[[:space:]]*"v0.9.0"'; then
  pass 'local /api/status returns v0.9.0'
else
  fail 'local /api/status did not return v0.9.0'
fi

subscription_body="$(body_get "$LOCAL_BASE_URL/api/subscription/status")"
if printf '%s' "$subscription_body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass 'local /api/subscription/status is reachable'
else
  fail 'local /api/subscription/status is not reachable'
fi

publish_body="$(body_get "$LOCAL_BASE_URL/api/publish-check/status")"
if printf '%s' "$publish_body" | grep -q '"checks"[[:space:]]*:'; then
  pass 'local /api/publish-check/status returns checks'
else
  fail 'local /api/publish-check/status did not return checks'
fi

claim_code="$(head_code "$PUBLIC_BASE_URL/claim")"
if [ "$claim_code" = "200" ]; then
  pass 'public /claim returns 200'
else
  fail "public /claim expected 200, got $claim_code"
fi

verify_body="$(body_post_json "$PUBLIC_BASE_URL/api/claim/verify" "{\"code\":\"$PROBE_CODE\"}")"
if printf '%s' "$verify_body" | grep -Eq 'INVALID_CLAIM_CODE|CLAIM_TOO_MANY_ATTEMPTS'; then
  pass 'public /api/claim/verify is reachable with safe probe code'
else
  fail 'public /api/claim/verify did not return expected safe error'
fi

for path in \
  /api/status \
  /api/subscription/status \
  /api/publish-check/status \
  /api/node-pool/status \
  /api/detection/xray/status \
  /; do
  code="$(head_code "$PUBLIC_BASE_URL$path")"
  if [ "$code" = "404" ]; then
    pass "public $path returns 404"
  else
    fail "public $path expected 404, got $code"
  fi
done

printf '\n'
if [ "$failures" -eq 0 ]; then
  pass 'final acceptance check completed'
  exit 0
fi

warn "final acceptance check completed with $failures failure(s)"
exit 1
