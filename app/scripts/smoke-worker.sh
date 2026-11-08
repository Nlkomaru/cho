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
config = config.replace(/("vars"\s*:\s*\{)/, `$1\n    "MCP_ALLOWED_ORIGINS": "${origin}",`);
const remoteMatches = config.match(/"remote"\s*:\s*(?:true|false)/g) ?? [];
if (remoteMatches.length !== 2) throw new Error(`Expected exactly two remote bindings, found ${remoteMatches.length}`);
config = config.replace(/"remote"\s*:\s*(?:true|false)/g, '"remote": false');
await writeFile(outputPath, config);
NODE

cd "$APP_DIR"
pnpm exec wrangler d1 migrations apply DB --local --persist-to "$PERSIST_DIR" --config "$CONFIG_FILE"
MCP_TOKEN_FILE="$PERSIST_DIR/mcp-token"
MCP_TOKEN_METADATA="$(node --input-type=module - "$MCP_TOKEN_FILE" <<'NODE'
import { createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const token = `cho_mcp_${randomBytes(32).toString("hex")}`;
await writeFile(process.argv[2], token, { mode: 0o600 });
process.stdout.write(
  `${createHash("sha256").update(token).digest("hex")}\n${token.slice(0, 16)}`,
);
NODE
)"
MCP_TOKEN_HASH="${MCP_TOKEN_METADATA%%$'\n'*}"
MCP_TOKEN_PREFIX="${MCP_TOKEN_METADATA#*$'\n'}"
unset MCP_TOKEN_METADATA
pnpm exec wrangler d1 execute DB --local --persist-to "$PERSIST_DIR" --config "$CONFIG_FILE" --command "INSERT INTO mcp_api_tokens (id, name, owner_subject, prefix, secret_hash, allowed_tools) VALUES ('smoke-mcp-token', 'Worker smoke', 'smoke', '$MCP_TOKEN_PREFIX', '$MCP_TOKEN_HASH', '[\"list_ingredients\"]');"
unset MCP_TOKEN_HASH MCP_TOKEN_PREFIX
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

mcp_body="$PERSIST_DIR/mcp-list.json"
mcp_token="$(cat "$MCP_TOKEN_FILE")"
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
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_ingredients","arguments":{}}}')"
unset mcp_token
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
if (response.jsonrpc !== "2.0" || response.id !== 2 || !Array.isArray(response.result?.structuredContent?.items))
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

printf 'Local Worker smoke passed: health, MCP tool call, meal UI, Storybook, meal list, create, and detail.\n'
