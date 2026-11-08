#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="$ROOT_DIR/app"
PERSIST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cho-worker-smoke.XXXXXX")"
CONFIG_FILE="$(mktemp "$APP_DIR/.wrangler-smoke.XXXXXX.jsonc")"
LOG_FILE="$PERSIST_DIR/wrangler.log"
SERVER_PID=""
BASE_URL="http://127.0.0.1:8791"

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$CONFIG_FILE"
  rm -rf "$PERSIST_DIR"
}
trap cleanup EXIT INT TERM

node --input-type=module - "$APP_DIR/wrangler.jsonc" "$CONFIG_FILE" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [sourcePath, outputPath] = process.argv.slice(2);
let config = await readFile(sourcePath, "utf8");
const databaseIdMatches = config.match(/"database_id"\s*:\s*"[^"]*"/g) ?? [];
if (databaseIdMatches.length !== 1) throw new Error(`Expected one database_id field, found ${databaseIdMatches.length}`);
config = config
  .replace('"main": "@tanstack/react-start/server-entry"', '"main": "./dist/server/index.js"')
  .replace(/"database_id"\s*:\s*"[^"]*"/, '"database_id": "33333333-3333-4333-8333-333333333333"');
const remoteMatches = config.match(/"remote"\s*:\s*(?:true|false)/g) ?? [];
if (remoteMatches.length !== 2) throw new Error(`Expected exactly two remote bindings, found ${remoteMatches.length}`);
config = config.replace(/"remote"\s*:\s*(?:true|false)/g, '"remote": false');
await writeFile(outputPath, config);
NODE

cd "$APP_DIR"
pnpm exec wrangler d1 migrations apply DB --local --persist-to "$PERSIST_DIR" --config "$CONFIG_FILE"
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

printf 'Local Worker smoke passed: health, meal UI, Storybook, meal list, create, and detail.\n'
