import { expect, test } from "vite-plus/test";
import {
  computeRecipeGanttSchedule,
  validateRecipeDag,
  type RecipeGanttBar,
} from "./recipe-scheduler";
import { recipeSchema, type RecipeJson } from "./recipe";

const ingredient = {
  id: "ing-main",
  ingredientId: "master-1",
  name: "Ingredient",
  amount: 10,
  unit: "g",
  displayAmount: "10 g",
};
const step = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  stepNumber: 1,
  phase: "prep",
  title: id,
  instruction: id,
  executionMode: "active",
  timing: { activeDurationSec: 1, passiveDurationSec: 0 },
  inputs: [],
  outputs: [{ id: `out-${id}`, label: `Output ${id}` }],
  ...overrides,
});
const recipe = (
  steps: unknown[],
  ingredients = [ingredient],
  ingredientGroups: unknown[] = [],
): RecipeJson => recipeSchema.parse({ ingredients, ingredientGroups, steps });
const chainRecipe = () =>
  recipe([
    step("source", { inputs: [{ type: "ingredient", ingredientEntryId: "ing-main" }] }),
    step("middle", {
      stepNumber: 2,
      dependsOnStepIds: ["source"],
      inputs: [{ type: "intermediate", fromStepId: "source", outputId: "out-source" }],
    }),
    step("finish", {
      stepNumber: 3,
      dependsOnStepIds: ["middle"],
      inputs: [{ type: "intermediate", fromStepId: "source", outputId: "out-source" }],
    }),
  ]);
function barById(bars: RecipeGanttBar[], stepId: string): RecipeGanttBar {
  const bar = bars.find((candidate) => candidate.stepId === stepId);
  if (!bar) throw new Error(`Missing gantt bar for step ${stepId}`);
  return bar;
}

test("validates bidirectional group membership and rejects one-sided links", () => {
  const groupedIngredient = { ...ingredient, groupId: "group-a" };
  const group = { id: "group-a", symbol: "A", label: "Group", ingredientEntryIds: ["ing-main"] };
  const good = recipe(
    [step("use", { inputs: [{ type: "group", groupId: "group-a" }] })],
    [groupedIngredient],
    [group],
  );
  expect(validateRecipeDag(good).success).toBe(true);
  const oneSidedGroup = { ...ingredient, groupId: null };
  const invalid = recipe(
    [step("use", { inputs: [{ type: "group", groupId: "group-a" }] })],
    [oneSidedGroup],
    [group],
  );
  expect(validateRecipeDag(invalid).success).toBe(false);
});

test("does not double-count group membership against individual ratios", () => {
  const groupedIngredient = { ...ingredient, groupId: "group-a" };
  const group = { id: "group-a", symbol: "A", label: "Group", ingredientEntryIds: ["ing-main"] };
  const mixed = recipe(
    [
      step("direct", {
        inputs: [{ type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 0.5 }],
      }),
      step("grouped", {
        stepNumber: 2,
        inputs: [{ type: "group", groupId: "group-a" }],
      }),
    ],
    [groupedIngredient],
    [group],
  );
  expect(validateRecipeDag(mixed).success).toBe(true);
  const individualOnly = recipe([
    step("direct", {
      inputs: [{ type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 0.5 }],
    }),
  ]);
  expect(
    validateRecipeDag(individualOnly).errors.some((error) => error.includes("usage ratios total")),
  ).toBeTruthy();
});

test("rejects unused ingredients, accepts the ratio tolerance boundary, and rejects excess usage", () => {
  const unused = recipe([step("empty")]);
  expect(
    validateRecipeDag(unused).errors.some((error) => error.includes("never used")),
  ).toBeTruthy();
  const withinTolerance = recipe([
    step("split", {
      inputs: [
        { type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 1 },
        { type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 0.01 },
      ],
    }),
  ]);
  expect(validateRecipeDag(withinTolerance).success).toBe(true);
  const overused = recipe([
    step("split", {
      inputs: [
        { type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 1 },
        { type: "ingredient", ingredientEntryId: "ing-main", amountRatio: 0.02 },
      ],
    }),
  ]);
  expect(
    validateRecipeDag(overused).errors.some((error) => error.includes("usage ratios total")),
  ).toBeTruthy();
});

test("accepts transitive intermediate dependencies and rejects an unknown output", () => {
  expect(validateRecipeDag(chainRecipe()).success).toBe(true);
  const bad = chainRecipe();
  const finish = bad.steps[2];
  if (!finish) throw new Error("Missing finish step in test fixture");
  const firstInput = finish.inputs[0];
  if (!firstInput) throw new Error("Missing finish input in test fixture");
  finish.inputs[0] = { type: "intermediate", fromStepId: "source", outputId: "missing-output" };
  expect(
    validateRecipeDag(bad).errors.some((error) => error.includes("missing output")),
  ).toBeTruthy();
});

test("detects dependency cycles", () => {
  const cyclic = recipe([
    step("a", {
      dependsOnStepIds: ["b"],
      inputs: [{ type: "ingredient", ingredientEntryId: "ing-main" }],
    }),
    step("b", { stepNumber: 2, dependsOnStepIds: ["a"] }),
  ]);
  expect(validateRecipeDag(cyclic).errors.some((error) => error.includes("cycle"))).toBeTruthy();
});

test("schedules independent prep into passive wait without overlapping active hand work", () => {
  const schedule = computeRecipeGanttSchedule(
    recipe([
      step("boil", {
        timing: { activeDurationSec: 10, passiveDurationSec: 20 },
        resourceTags: ["stove"],
        inputs: [{ type: "ingredient", ingredientEntryId: "ing-main" }],
      }),
      step("prep", { stepNumber: 2, timing: { activeDurationSec: 10, passiveDurationSec: 0 } }),
    ]),
  );
  const boil = barById(schedule.bars, "boil");
  const prep = barById(schedule.bars, "prep");
  expect(prep.startSec >= boil.activeEndSec).toBeTruthy();
  expect(prep.startSec < boil.endSec).toBeTruthy();
  expect(prep.activeEndSec <= boil.endSec).toBeTruthy();
});

test("excludes concurrent use of the same resource through passive occupancy", () => {
  const schedule = computeRecipeGanttSchedule(
    recipe([
      step("oven-wait", {
        executionMode: "passive",
        timing: { activeDurationSec: 0, passiveDurationSec: 20 },
        resourceTags: ["oven"],
        inputs: [{ type: "ingredient", ingredientEntryId: "ing-main" }],
      }),
      step("oven-work", {
        stepNumber: 2,
        timing: { activeDurationSec: 5, passiveDurationSec: 0 },
        resourceTags: ["oven"],
      }),
    ]),
  );
  expect(barById(schedule.bars, "oven-work").startSec >= 20).toBeTruthy();
});

test("returns deterministic gantt bars and lane order for identical input", () => {
  const input = recipe([
    step("one", {
      inputs: [{ type: "ingredient", ingredientEntryId: "ing-main" }],
      resourceTags: ["board"],
    }),
    step("two", { stepNumber: 2 }),
  ]);
  const first = computeRecipeGanttSchedule(input);
  expect(first).toEqual(computeRecipeGanttSchedule(input));
  expect(first.bars.map(({ stepId, startSec, endSec }) => ({ stepId, startSec, endSec }))).toEqual([
    { stepId: "one", startSec: 0, endSec: 1 },
    { stepId: "two", startSec: 1, endSec: 2 },
  ]);
  expect(first.lanes.map(({ id }) => id)).toEqual(["cook-hand", "waiting", "board"]);
});
