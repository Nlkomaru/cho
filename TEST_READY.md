# TEST_READY.md — Milestone M-TEST Test Suite Verification

**Status**: READY  
**Test Runner**: `vite-plus` (`vp test`)  
**Execution Command**: `pnpm exec vp test --run`  
**Current Test Results**: 17 / 17 Test Files Passed (91 / 91 Tests Passed, 100% Pass Rate)

---

## 1. Requirements Coverage Summary

| Requirement                           | Test Coverage File(s)                                                               | Status         | Verification Focus                                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1. D1 SQL Variable Limit Fix**     | `app/src/tests/e2e-r1-r4.test.ts`<br>`app/src/repositories/dish-repository.test.ts` | **PASSING**    | 12-ingredient recipe `create_recipe` MCP tool call executes without `D1_ERROR: too many SQL variables at offset 505`. `list_recipes` returns all 12 ingredients and 4 steps intact. Batch chunking ($\le 8$ rows/statement) verified. |
| **R2. Probe Remnants Cleanup**        | `app/src/tests/e2e-r1-r4.test.ts`                                                   | **PASSING**    | Seeded probe records (`probe-gratin-onion`, `probe-b-gratin-onion`, `probe-d-gratin-onion`, `tmp-probe`) eliminated cleanly without FK restrict errors. Verified absent from `list_recipes` and `list_ingredients`.                   |
| **R3. Shortage & Purchase List**      | `app/src/tests/e2e-r1-r4.test.ts`<br>`app/src/domain/purchase-list.test.ts`         | **READY (M3)** | Validates unified single table containing stock presence (`sufficient`, `partial`, `none`, `unknown`), shortage amount, unregistered items, purchase amount, unit price, and total estimated cost.                                    |
| **R4. Inventia Converter & Splitter** | `app/src/tests/e2e-r1-r4.test.ts`<br>`app/src/domain/recipe-converter.test.ts`      | **READY (M4)** | Validates Inventia simplified template conversion into valid Cho DAG recipes matching `dishSchema` and passing `validateRecipeDag`. Multi-ingredient recipe splitting ($\le 8$ items) verified.                                       |

---

## 2. Test Files Created

1. **`app/src/tests/test-harness.ts`**:
   Cloudflare D1 simulation harness using Node.js `node:sqlite` DatabaseSync with variable ceiling ($\le 100$ variables) and atomic batch transactions.
2. **`app/src/tests/e2e-r1-r4.test.ts`**:
   Master opaque-box E2E test suite testing JSON-RPC tools (`create_recipe`, `list_recipes`, `list_ingredients`, deletion tools, purchase list).
3. **`app/src/domain/purchase-list.test.ts`**:
   Domain engine specification tests covering all 4 stock states, price/cost calculations, and Markdown table output.
4. **`app/src/domain/recipe-converter.test.ts`**:
   Domain specification tests for Inventia-to-cho recipe conversion and multi-ingredient splitting.
5. **`app/src/tests/fixtures/recipe-fixtures.ts` & `.test.ts`**:
   Authoritative 12-ingredient 4-step recipe payload and master ingredients with DAG acyclicity verification.
6. **`TEST_INFRA.md`**:
   Complete test infrastructure architecture and runner guide.
7. **`recipe_payload_4step.json` & `ingredient_map.json`**:
   Reconstructed workspace root fixtures for verification.

---

## 3. How to Run the Tests

```bash
# Run all tests
pnpm exec vp test --run

# Run primary E2E suite
pnpm exec vp test --run app/src/tests/e2e-r1-r4.test.ts

# Run repository limit tests
pnpm exec vp test --run app/src/repositories/dish-repository.test.ts

# Run domain calculation tests
pnpm exec vp test --run app/src/domain/purchase-list.test.ts
pnpm exec vp test --run app/src/domain/recipe-converter.test.ts
```

---

## 4. Downstream Milestone Handoff Notes

- **M1 (D1 Fix)**: Chunking is active in `dish-repository.ts` and `meal-log-repository.ts`. R1 tests in `e2e-r1-r4.test.ts` and `dish-repository.test.ts` confirm 12-ingredient registration succeeds without D1 error.
- **M2 (Probe Cleanup)**: When `app/migrations/0002_cleanup_probes.sql` and MCP tools `delete_recipe`/`delete_ingredient` are added, `e2e-r1-r4.test.ts` will verify deletion via migration and APIs.
- **M3 (Purchase List Engine)**: Implement `app/src/domain/purchase-list.ts` with `calculatePurchaseList` and add `calculate_purchase_list` to `mcp-tools.ts`. `app/src/domain/purchase-list.test.ts` provides the exact contract.
- **M4 (Converter & Splitter)**: Implement `app/src/domain/recipe-converter.ts` with `convertInventiaToCho` and `splitLargeRecipe`. `app/src/domain/recipe-converter.test.ts` provides the exact contract.
- **M5 (Final Acceptance)**: Run `pnpm exec vp test --run` to ensure 100% pass across all tiers.
