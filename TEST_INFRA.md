# Test Infrastructure Documentation (TEST_INFRA.md)

This document describes the testing architecture, 4-tier test strategy, in-memory Cloudflare D1 simulation harness, test suites, and execution commands for the Cho application.

---

## 1. Architecture & 4-Tier Test Strategy

The test suite is structured across 4 progressive tiers to enable fast local execution, exact error reproduction, and end-to-end acceptance verification:

```
+-----------------------------------------------------------------------------------+
| Tier 4: Worker Acceptance & Deployment Verification                               |
| - smoke-worker.sh against local Wrangler D1 runtime                               |
| - Verifies production packaging, edge assets, and live MCP transport              |
+-----------------------------------------------------------------------------------+
                                          ▲
+-----------------------------------------------------------------------------------+
| Tier 3: Opaque-Box E2E & MCP Integration                                          |
| - app/src/tests/e2e-r1-r4.test.ts                                                 |
| - JSON-RPC tools/call requests against full Hono API                              |
| - Verifies R1 (12-ingredient recipe), R2 (probe cleanup), R3 (purchase list), R4  |
+-----------------------------------------------------------------------------------+
                                          ▲
+-----------------------------------------------------------------------------------+
| Tier 2: Repository & Database Chunking Integration                                |
| - app/src/repositories/dish-repository.test.ts                                   |
| - Validates statement chunking (<= 8 items/stmt => <= 88 bind parameters <= 100)  |
| - Validates dishes and meal logs batch atomic insertion & update                  |
+-----------------------------------------------------------------------------------+
                                          ▲
+-----------------------------------------------------------------------------------+
| Tier 1: Unit & Domain Specification Tests                                         |
| - app/src/domain/purchase-list.test.ts (R3 shortage & 1-table calculation)        |
| - app/src/domain/recipe-converter.test.ts (R4 Inventia converter & splitter)      |
| - app/src/tests/fixtures/recipe-fixtures.test.ts (DAG & schema validation)        |
+-----------------------------------------------------------------------------------+
```

---

## 2. In-Memory D1 Emulation Engine (`app/src/tests/test-harness.ts`)

Cloudflare D1 enforces an internal limit of `SQLITE_MAX_VARIABLE_NUMBER = 100` parameters per prepared statement. When an application executes a multi-row insert with >100 parameters, D1 halts with:
`D1_ERROR: too many SQL variables at offset 505`.

Node.js standard SQLite does not enforce this by default. To faithfully detect variable overflow bugs before deployment, the test harness (`createTestD1Harness`) emulates D1 behavior:

1. **Automatic Migration Execution**: Reads all migrations in `app/migrations/*.sql` in sorted order and executes them against an in-memory SQLite database (`DatabaseSync(":memory:")`).
2. **Hard Ceiling Enforcement**:
   ```typescript
   bind(...parameters: SQLInputValue[]) {
     if (enforceLimit && parameters.length > maxVars) {
       throw new Error(
         `D1_ERROR: too many SQL variables at offset 505: statement has ${parameters.length} bound variables (limit is ${maxVars})`
       );
     }
     ...
   }
   ```
3. **Atomic Batch Transactions**: Statements submitted via `db.batch` are wrapped in `BEGIN ... COMMIT / ROLLBACK` transactions matching D1 semantics.
4. **Token Generation & MCP Invocation**: Provides `issueToken()` and `callMcp()` helpers for opaque-box JSON-RPC verification.

---

## 3. Test Suites & File Organization

| Test File                                        | Tier   | Focus Requirements | Description                                                                      |
| ------------------------------------------------ | ------ | ------------------ | -------------------------------------------------------------------------------- |
| `app/src/tests/e2e-r1-r4.test.ts`                | Tier 3 | R1, R2, R3, R4     | Comprehensive opaque-box E2E MCP and API tests.                                  |
| `app/src/repositories/dish-repository.test.ts`   | Tier 2 | R1                 | Multi-row batch chunking tests for dishes and meal logs.                         |
| `app/src/domain/purchase-list.test.ts`           | Tier 1 | R3                 | Domain calculation for shortage, stock presence, unit price, and Markdown table. |
| `app/src/domain/recipe-converter.test.ts`        | Tier 1 | R4                 | Inventia simplified recipe parsing, DAG generation, and large recipe splitting.  |
| `app/src/tests/fixtures/recipe-fixtures.test.ts` | Tier 1 | R1, R4             | Validates 12-ingredient 4-step fixture DAG acyclicity and Zod schema.            |
| `app/src/api/mcp-routes.test.ts`                 | Tier 3 | MCP Auth           | MCP token lifecycle, daily usage tracking, and security controls.                |

---

## 4. Verification Resources & Fixtures

- `recipe_payload_4step.json` / `app/src/tests/fixtures/recipe_payload_4step.json`:
  Authoritative 12-ingredient, 4-step recipe payload (`prep`, `cook`, `assemble`, `finish`) with 100% complete DAG ratios and acyclic dependency graphs.
- `ingredient_map.json` / `app/src/tests/fixtures/ingredient_map.json`:
  Master dictionary mapping all 12 Japanese ingredient names to Cho internal UUIDs (`ing-onion`, `ing-macaroni`, etc.).
- `app/src/tests/fixtures/recipe-fixtures.ts`:
  Type-safe generator functions for master ingredient definitions and 12-ingredient payloads.

---

## 5. Execution Commands

### Running Tests via `vite-plus`

```bash
# Run entire test suite across all modules (17 test files, 91 tests)
pnpm exec vp test --run

# Run primary E2E suite (R1-R4)
pnpm exec vp test --run app/src/tests/e2e-r1-r4.test.ts

# Run repository chunking tests (R1)
pnpm exec vp test --run app/src/repositories/dish-repository.test.ts

# Run purchase list calculation tests (R3)
pnpm exec vp test --run app/src/domain/purchase-list.test.ts

# Run recipe converter and splitter tests (R4)
pnpm exec vp test --run app/src/domain/recipe-converter.test.ts
```

### Running Worker Smoke Test

```bash
# Spins up local Wrangler worker on local D1 and issues curl requests
pnpm run smoke:worker
```

---

## 6. Coverage & Quality Gates

- **Statement Parameter Safety**: All batch insert statements must contain $\le 88$ parameters ($\le 8$ rows $\times 11$ columns), guaranteeing zero `D1_ERROR: too many SQL variables` errors on Cloudflare D1.
- **Strict Lint Compliance**: Zero `@typescript-eslint/no-explicit-any` and zero non-null assertion `!` operators in test code.
- **Independence & Isolation**: Every test creates its own in-memory database instance with freshly applied migrations. No test state is shared across tests.
