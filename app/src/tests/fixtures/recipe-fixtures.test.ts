import { expect, test } from "vite-plus/test";
import { dishSchema } from "../../domain/ingredient";
import { validateRecipeDag } from "../../domain/recipe-scheduler";
import { createTwelveIngredientRecipePayload } from "./recipe-fixtures";

test("twelve-ingredient recipe payload passes DAG and schema validation", () => {
  const payload = createTwelveIngredientRecipePayload();
  expect(payload.recipe.ingredients).toHaveLength(12);
  expect(payload.recipe.steps).toHaveLength(4);

  // Validate DAG integrity
  const dagResult = validateRecipeDag(payload.recipe);
  expect(dagResult.success).toBe(true);
  expect(dagResult.errors).toEqual([]);

  // Validate dish schema with mock id
  const dishParse = dishSchema.safeParse({
    id: "test-dish-12-items",
    ...payload,
    totalNutrition: null,
    totalCostYen: null,
    coverImageId: null,
  });
  expect(dishParse.success).toBe(true);
});
