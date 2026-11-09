#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$ROOT_DIR/app"
PERSIST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cho-worker-smoke.XXXXXX")"
CONFIG_FILE="$(mktemp "$APP_DIR/.wrangler-smoke.XXXXXX.jsonc")"
LOG_FILE="$PERSIST_DIR/wrangler.log"
SERVER_PID=""
BASE_URL="http://127.0.0.1:8791"
MCP_SMOKE_ORIGIN="https://cho-smoke.example"

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$CONFIG_FILE"
  rm -rf "$PERSIST_DIR"
}
trap cleanup EXIT INT TERM

node --input-type=module - "$APP_DIR/wrangler.jsonc" "$CONFIG_FILE" "$MCP_SMOKE_ORIGIN" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [sourcePath, outputPath, origin] = process.argv.slice(2);
let config = await readFile(sourcePath, "utf8");
const databaseIdMatches = config.match(/"database_id"\s*:\s*"[^"]*"/g) ?? [];
if (databaseIdMatches.length !== 1) throw new Error(`Expected one database_id field, found ${databaseIdMatches.length}`);
config = config
  .replace('"main": "@tanstack/react-start/server-entry"', '"main": "./dist/server/index.js"')
  .replace(/"database_id"\s*:\s*"[^"]*"/, '"database_id": "33333333-3333-4333-8333-333333333333"');
const varsMatches = config.match(/"vars"\s*:\s*\{/g) ?? [];
if (varsMatches.length !== 1) throw new Error(`Expected one vars object, found ${varsMatches.length}`);
config = config.replace(
  /("vars"\s*:\s*\{)/,
  `$1\n    "MCP_MANAGEMENT_ENABLED": "true",\n    "MCP_ALLOWED_ORIGINS": "${origin}",`,
);
const remoteMatches = config.match(/"remote"\s*:\s*(?:true|false)/g) ?? [];
if (remoteMatches.length !== 2) throw new Error(`Expected exactly two remote bindings, found ${remoteMatches.length}`);
config = config.replace(/"remote"\s*:\s*(?:true|false)/g, '"remote": false');
await writeFile(outputPath, config);
NODE

cd "$APP_DIR"
CI=true pnpm exec wrangler d1 migrations apply DB --local --persist-to "$PERSIST_DIR" --config "$CONFIG_FILE" </dev/null
pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8791 --persist-to "$PERSIST_DIR" --config "$CONFIG_FILE" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

request() {
  local method="$1" path="$2" output="$3"
  shift 3
  curl --silent --show-error -X "$method" -o "$output" -w '%{http_code}' "$BASE_URL$path" "$@"
}
fail_with_logs() {
  printf 'Smoke assertion failed: %s\n' "$1" >&2
  if [[ -f "$LOG_FILE" ]]; then cat "$LOG_FILE" >&2; fi
  exit 1
}
assert_status() {
  local actual="$1" expected="$2" endpoint="$3"
  [[ "$actual" == "$expected" ]] || fail_with_logs "$endpoint returned HTTP $actual (expected $expected)"
}

health_body="$PERSIST_DIR/health.json"
health_status=""
for _ in $(seq 1 60); do
  if health_status="$(request GET /api/health "$health_body")" && [[ "$health_status" == "200" ]]; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then fail_with_logs "Wrangler exited before becoming healthy"; fi
  sleep 1
done
assert_status "$health_status" 200 /api/health
[[ "$(cat "$health_body")" == '{"status":"ok"}' ]] || fail_with_logs "/api/health returned unexpected JSON: $(cat "$health_body")"

unauth_mcp_body="$PERSIST_DIR/mcp-unauth.json"
unauth_status="$(request POST /api/mcp "$unauth_mcp_body" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_ingredients","arguments":{}}}')"
assert_status "$unauth_status" 401 'Unauthenticated POST /api/mcp'

token_issue_body="$PERSIST_DIR/mcp-token-issue.json"
token_issue_status="$(request POST /api/mcp/tokens "$token_issue_body" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Worker smoke","allowedTools":["list_ingredients"]}')"
assert_status "$token_issue_status" 201 'POST /api/mcp/tokens'
node --input-type=module - "$token_issue_body" "$PERSIST_DIR/mcp-token-id" "$PERSIST_DIR/mcp-token-secret" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [bodyFile, idFile, secretFile] = process.argv.slice(2);
const data = JSON.parse(await readFile(bodyFile, "utf8"));
if (!data.id || typeof data.id !== "string") throw new Error("POST /api/mcp/tokens missing id");
if (!data.secret || !/^cho_mcp_[A-Za-z0-9_-]{20,80}$/.test(data.secret))
  throw new Error(`POST /api/mcp/tokens returned invalid secret: ${data.secret}`);
await writeFile(idFile, data.id, { mode: 0o600 });
await writeFile(secretFile, data.secret, { mode: 0o600 });
NODE
mcp_token_id="$(cat "$PERSIST_DIR/mcp-token-id")"
mcp_token="$(cat "$PERSIST_DIR/mcp-token-secret")"

token_list_body="$PERSIST_DIR/mcp-token-list.json"
token_list_status="$(request GET /api/mcp/tokens "$token_list_body")"
assert_status "$token_list_status" 200 'GET /api/mcp/tokens'
node --input-type=module - "$token_list_body" "$mcp_token_id" "$mcp_token" <<'NODE'
import { readFile } from "node:fs/promises";
const [bodyFile, tokenId, tokenSecret] = process.argv.slice(2);
const text = await readFile(bodyFile, "utf8");
if (text.includes(tokenSecret)) throw new Error("GET /api/mcp/tokens leaked client secret");
if (text.includes("secretHash")) throw new Error("GET /api/mcp/tokens leaked secretHash");
const data = JSON.parse(text);
if (!Array.isArray(data.tokens) || !data.tokens.some((t) => t.id === tokenId))
  throw new Error("GET /api/mcp/tokens did not list issued token");
NODE

mcp_body="$PERSIST_DIR/mcp-list.json"
mcp_status="$(request POST /api/mcp "$mcp_body" \
  -H "Authorization: Bearer $mcp_token" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_ingredients","arguments":{}}}')"
assert_status "$mcp_status" 200 'POST /api/mcp without Origin'
node --input-type=module - "$mcp_body" <<'NODE'
import { readFile } from "node:fs/promises";
const response = JSON.parse(await readFile(process.argv[2], "utf8"));
if (response.jsonrpc !== "2.0" || response.id !== 1 || !Array.isArray(response.result?.structuredContent?.items))
  throw new Error("POST /api/mcp did not return the list_ingredients protocol result");
NODE

denied_mcp_body="$PERSIST_DIR/mcp-denied.json"
denied_status="$(request POST /api/mcp "$denied_mcp_body" \
  -H "Authorization: Bearer $mcp_token" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"record_meal","arguments":{}}}')"
assert_status "$denied_status" 200 'POST /api/mcp disallowed tool'
node --input-type=module - "$denied_mcp_body" <<'NODE'
import { readFile } from "node:fs/promises";
const response = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!response.result?.isError && !response.error)
  throw new Error("POST /api/mcp allowed a tool outside allowedTools");
NODE

preflight_headers="$PERSIST_DIR/mcp-preflight.headers"
preflight_status="$(request OPTIONS /api/mcp "$PERSIST_DIR/mcp-preflight.body" \
  -D "$preflight_headers" \
  -H "Origin: $MCP_SMOKE_ORIGIN" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Authorization,Content-Type,Accept,MCP-Protocol-Version')"
assert_status "$preflight_status" 204 'OPTIONS /api/mcp preflight'
node --input-type=module - "$preflight_headers" "$MCP_SMOKE_ORIGIN" <<'NODE'
import { readFile } from "node:fs/promises";
const [file, origin] = process.argv.slice(2);
const headers = new Headers((await readFile(file, "utf8")).split(/\r?\n/)
  .map((line) => line.match(/^([^:]+):\s*(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2]]));
for (const [name, value] of Object.entries({
  "access-control-allow-origin": origin,
  "access-control-allow-methods": "POST,GET,OPTIONS",
  "access-control-allow-headers": "Authorization,Content-Type,Accept,MCP-Protocol-Version",
  "access-control-max-age": "600",
  vary: "Origin, Access-Control-Request-Headers",
})) {
  if (headers.get(name) !== value) throw new Error(`Preflight ${name} was ${headers.get(name) ?? "(missing)"}`);
}
NODE

browser_mcp_headers="$PERSIST_DIR/mcp-browser.headers"
browser_mcp_body="$PERSIST_DIR/mcp-browser.json"
browser_mcp_status="$(request POST /api/mcp "$browser_mcp_body" \
  -D "$browser_mcp_headers" \
  -H "Authorization: Bearer $mcp_token" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Origin: $MCP_SMOKE_ORIGIN" \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_ingredients","arguments":{}}}')"
assert_status "$browser_mcp_status" 200 'Origin-bearing POST /api/mcp'
node --input-type=module - "$browser_mcp_headers" "$browser_mcp_body" "$MCP_SMOKE_ORIGIN" <<'NODE'
import { readFile } from "node:fs/promises";
const [headersFile, bodyFile, origin] = process.argv.slice(2);
const headers = new Headers((await readFile(headersFile, "utf8")).split(/\r?\n/)
  .map((line) => line.match(/^([^:]+):\s*(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2]]));
if (headers.get("access-control-allow-origin") !== origin)
  throw new Error("Origin-bearing POST did not return the allowed Access-Control-Allow-Origin");
const response = JSON.parse(await readFile(bodyFile, "utf8"));
if (response.jsonrpc !== "2.0" || response.id !== 3 || !Array.isArray(response.result?.structuredContent?.items))
  throw new Error("Origin-bearing POST did not return the list_ingredients protocol result");
NODE

get_status="$(request GET /api/mcp "$PERSIST_DIR/mcp-get.body" -D "$PERSIST_DIR/mcp-get.headers" -H "Origin: $MCP_SMOKE_ORIGIN")"
assert_status "$get_status" 405 'GET /api/mcp'
node --input-type=module - "$PERSIST_DIR/mcp-get.headers" <<'NODE'
import { readFile } from "node:fs/promises";
const headers = (await readFile(process.argv[2], "utf8")).toLowerCase();
if (!headers.split(/\r?\n/).includes("allow: post, options"))
  throw new Error("GET /api/mcp did not return Allow: POST, OPTIONS");
NODE

usage_body="$PERSIST_DIR/mcp-usage.json"
usage_status="$(request GET /api/mcp/usage "$usage_body")"
assert_status "$usage_status" 200 'GET /api/mcp/usage'
node --input-type=module - "$usage_body" "$mcp_token_id" <<'NODE'
import { readFile } from "node:fs/promises";
const [bodyFile, tokenId] = process.argv.slice(2);
const data = JSON.parse(await readFile(bodyFile, "utf8"));
if (!data.summary || typeof data.summary.totalCalls !== "number" || data.summary.totalCalls < 1)
  throw new Error(`GET /api/mcp/usage summary.totalCalls must be >= 1, got ${data.summary?.totalCalls}`);
if (!Array.isArray(data.usage) || !data.usage.some((u) => u.tokenId === tokenId && u.totalCalls >= 1))
  throw new Error("GET /api/mcp/usage did not record calls for token");
NODE

delete_status="$(request DELETE "/api/mcp/tokens/$mcp_token_id" "$PERSIST_DIR/mcp-token-delete.body")"
assert_status "$delete_status" 204 "DELETE /api/mcp/tokens/$mcp_token_id"

revoked_mcp_body="$PERSIST_DIR/mcp-revoked.json"
revoked_status="$(request POST /api/mcp "$revoked_mcp_body" \
  -H "Authorization: Bearer $mcp_token" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_ingredients","arguments":{}}}')"
unset mcp_token mcp_token_id
assert_status "$revoked_status" 401 'Revoked token POST /api/mcp'

home_body="$PERSIST_DIR/home.html"
status="$(request GET / "$home_body")"
assert_status "$status" 200 /
[[ "$(cat "$home_body")" == *"食事記録"* ]] || fail_with_logs "/ did not contain 食事記録"

storybook_body="$PERSIST_DIR/storybook.html"
status="$(request GET /storybook/ "$storybook_body")"
assert_status "$status" 200 /storybook/
[[ "$(cat "$storybook_body")" == *"Storybook"* ]] || fail_with_logs "/storybook/ did not contain Storybook HTML"

meals_body="$PERSIST_DIR/meals.json"
status="$(request GET /api/meals "$meals_body")"
assert_status "$status" 200 /api/meals
node --input-type=module - "$meals_body" <<'NODE'
import { readFile } from "node:fs/promises";
const body = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!Array.isArray(body.meals) || typeof body.summary?.day?.priceYen !== "number")
  throw new Error("GET /api/meals did not return meals with a summary");
NODE

post_body="$PERSIST_DIR/created-meal.json"
post_status="$(request POST /api/meals "$post_body" -H 'Content-Type: application/json' --data '{"eatenAt":"2026-11-08T18:30:00.000Z","mealTiming":"dinner","sourceType":"other","placeName":null,"title":"Local smoke meal","totalPriceYen":350,"totalNutrition":null,"rating":null,"memo":null,"imageIds":[],"items":[{"dishId":null,"ingredientId":null,"name":"Local smoke item","priceYen":350,"nutrition":{"caloriesKcal":400,"proteinG":20,"fatG":10,"carbohydrateG":55,"fiberG":4,"saltEquivalentG":1.2,"micronutrients":[]},"estimationSource":"manual","servingsFactor":1,"sortOrder":0}]}')"
assert_status "$post_status" 201 'POST /api/meals'
meal_id="$(node --input-type=module - "$post_body" <<'NODE'
import { readFile } from "node:fs/promises";
const meal = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!meal.id || meal.title !== "Local smoke meal") throw new Error("POST /api/meals returned unexpected meal data");
process.stdout.write(meal.id);
NODE
)"

detail_body="$PERSIST_DIR/meal-detail.json"
status="$(request GET "/api/meals/$meal_id" "$detail_body")"
assert_status "$status" 200 "/api/meals/$meal_id"
node --input-type=module - "$detail_body" <<'NODE'
import { readFile } from "node:fs/promises";
const meal = JSON.parse(await readFile(process.argv[2], "utf8"));
if (meal.title !== "Local smoke meal") throw new Error("GET meal detail title did not match POST");
NODE

printf 'Local Worker smoke passed: health, MCP tokens, usage & tools, meal UI, Storybook, meal list, create, and detail.\n'
