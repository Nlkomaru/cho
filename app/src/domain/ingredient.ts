import { z } from "zod";
import {
  nutritionFactsSchema,
  scaleNutritionFacts,
  sumNutritionFacts,
  type NutritionFacts,
} from "./nutrition";
import { recipeSchema } from "./recipe";

export const ingredientSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    normalizedName: z.string().trim().min(1).max(160).nullable().default(null),
    baseDimension: z.enum(["mass", "volume", "count"]),
    baseUnit: z.string().trim().min(1).max(50),
    nutritionBasisAmount: z.number().positive(),
    nutritionPerBasis: nutritionFactsSchema,
    gramPerUnit: z.number().positive().nullable().default(null),
    inventiaItemId: z.string().trim().min(1).max(128).nullable().default(null),
    latestUnitPriceYen: z.number().min(0).nullable().default(null),
    latestPriceUpdatedAt: z.string().datetime().nullable().default(null),
    memo: z.string().max(2000).nullable().default(null),
  })
  .strict()
  .superRefine((ingredient, context) => {
    if (
      ingredient.baseDimension === "mass" &&
      (ingredient.baseUnit !== "g" || ingredient.nutritionBasisAmount !== 100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseUnit"],
        message: "Mass ingredients must use g with a 100 g nutrition basis",
      });
    }
    if (
      ingredient.baseDimension === "volume" &&
      (ingredient.baseUnit !== "mL" || ingredient.nutritionBasisAmount !== 100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseUnit"],
        message: "Volume ingredients must use mL with a 100 mL nutrition basis",
      });
    }
    if (ingredient.baseDimension === "count" && ingredient.nutritionBasisAmount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["nutritionBasisAmount"],
        message: "Count ingredients must use a one-unit nutrition basis",
      });
    }
  });
export type Ingredient = z.infer<typeof ingredientSchema>;

export function calculateIngredientNutrition(
  ingredient: Pick<Ingredient, "nutritionPerBasis" | "nutritionBasisAmount">,
  amount: number,
): NutritionFacts {
  if (!Number.isFinite(amount) || amount < 0)
    throw new RangeError("Ingredient amount must be finite and non-negative");
  return scaleNutritionFacts(
    ingredient.nutritionPerBasis,
    amount / ingredient.nutritionBasisAmount,
  );
}
export function calculateIngredientCost(
  ingredient: Pick<Ingredient, "nutritionBasisAmount" | "latestUnitPriceYen">,
  amount: number,
): number | null {
  if (!Number.isFinite(amount) || amount < 0)
    throw new RangeError("Ingredient amount must be finite and non-negative");
  return ingredient.latestUnitPriceYen === null
    ? null
    : (ingredient.latestUnitPriceYen * amount) / ingredient.nutritionBasisAmount;
}
export const calculateUnitCost = calculateIngredientCost;

export const dishSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(64).nullable().default(null),
    servings: z.int().min(1).max(100),
    recipe: recipeSchema,
    totalNutrition: nutritionFactsSchema.nullable().default(null),
    totalCostYen: z.number().min(0).nullable().default(null),
    coverImageId: z.string().trim().min(1).max(128).nullable().default(null),
    notes: z.string().max(4000).nullable().default(null),
  })
  .strict();
export type Dish = z.infer<typeof dishSchema>;
export function calculateDishNutrition(
  ingredients: readonly { ingredient: Ingredient; amount: number }[],
  servings: number,
): NutritionFacts {
  if (!Number.isInteger(servings) || servings < 1)
    throw new RangeError("Servings must be a positive integer");
  return scaleNutritionFacts(
    sumNutritionFacts(
      ingredients.map(({ ingredient, amount }) => calculateIngredientNutrition(ingredient, amount)),
    ),
    1 / servings,
  );
}
export function calculateDishCost(
  ingredients: readonly { ingredient: Ingredient; amount: number }[],
  servings = 1,
): number | null {
  if (!Number.isInteger(servings) || servings < 1)
    throw new RangeError("Servings must be a positive integer");
  let total = 0;
  for (const { ingredient, amount } of ingredients) {
    const cost = calculateIngredientCost(ingredient, amount);
    if (cost === null) return null;
    total += cost;
  }
  return total / servings;
}

export const mealLogSourceSchema = z.enum([
  "self_cooked",
  "cafeteria",
  "convenience",
  "supermarket",
  "snack",
  "restaurant",
  "other",
]);
export const ingredientCostBreakdownEntrySchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    amount: z.number().min(0),
    unit: z.string().trim().min(1).max(50),
    costYen: z.number().min(0),
  })
  .strict();
export type IngredientCostBreakdownEntry = z.infer<typeof ingredientCostBreakdownEntrySchema>;
export const mealLogItemBaseSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    dishId: z.string().trim().min(1).max(128).nullable().default(null),
    ingredientId: z.string().trim().min(1).max(128).nullable().default(null),
    name: z.string().trim().min(1).max(160),
    servingsFactor: z.number().positive().default(1),
    priceYen: z.number().min(0).nullable().default(null),
    nutrition: nutritionFactsSchema.nullable().default(null),
    ingredientCostBreakdown: z.array(ingredientCostBreakdownEntrySchema).default([]),
    estimationSource: z.enum(["manual", "recipe", "ingredient", "ai", "unknown"]).default("manual"),
    sortOrder: z.int().min(0).default(0),
  })
  .strict();
export const mealLogItemSchema = mealLogItemBaseSchema.refine(
  (item) => !(item.dishId !== null && item.ingredientId !== null),
  "An item cannot reference both a dish and an ingredient",
);
export type MealLogItem = z.infer<typeof mealLogItemSchema>;
export const mealLogSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    eatenAt: z.string().datetime(),
    mealTiming: z
      .enum(["breakfast", "lunch", "dinner", "snack", "late_snack"])
      .nullable()
      .default(null),
    sourceType: mealLogSourceSchema,
    placeName: z.string().trim().max(160).nullable().default(null),
    title: z.string().trim().min(1).max(160),
    totalPriceYen: z.number().min(0).nullable().default(null),
    totalNutrition: nutritionFactsSchema.nullable().default(null),
    rating: z.int().min(1).max(5).nullable().default(null),
    memo: z.string().max(4000).nullable().default(null),
    inventiaConsumptionStatus: z.enum(["pending", "succeeded", "failed"]).nullable().default(null),
    imageIds: z.array(z.string().trim().min(1).max(128)).default([]),
    items: z.array(mealLogItemSchema).min(1),
  })
  .strict();
export type MealLog = z.infer<typeof mealLogSchema>;
