import { z } from "zod";
import {
  nutritionFactsSchema,
  scaleNutritionFacts,
  sumNutritionFacts,
  type NutritionFacts,
} from "./nutrition";
import { imageIdSchema, recipeSchema } from "./recipe";

export const inventiaItemIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "Inventia item ID may only contain letters, digits, - and _");

export const ingredientObjectSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    normalizedName: z.string().trim().min(1).max(160).nullable().default(null),
    baseDimension: z.enum(["mass", "volume", "count"]),
    baseUnit: z.string().trim().min(1).max(50),
    nutritionBasisAmount: z.number().positive(),
    nutritionPerBasis: nutritionFactsSchema,
    gramPerUnit: z.number().positive().nullable().default(null),
    inventiaItemId: inventiaItemIdSchema.nullable().default(null),
    latestUnitPriceYen: z.number().min(0).nullable().default(null),
    latestPriceUpdatedAt: z.string().datetime().nullable().default(null),
    /** Last Inventia lookup, successful or not; throttles retries without faking freshness. */
    latestPriceAttemptedAt: z.string().datetime().nullable().default(null),
    memo: z.string().max(2000).nullable().default(null),
  })
  .strict();

export const ingredientSchema = ingredientObjectSchema.superRefine((ingredient, context) => {
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

/** Factor from a mass/volume unit to its smallest unit (g or mL); case-insensitive like Inventia. */
const smallestUnitFactors: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000 };

/**
 * Converts an Inventia comparison unit price into Cho's `latestUnitPriceYen`.
 *
 * Inventia reports yen per 100 g / 100 mL (always the smallest unit, even for kg/L items) and yen
 * per one base unit for count items. Cho stores yen per `nutritionBasisAmount` of `baseUnit`.
 * Returns null when a mass/volume unit cannot be converted.
 */
export function inventiaUnitPriceToBasisPrice(
  unitPrice: number,
  ingredient: Pick<Ingredient, "baseDimension" | "baseUnit" | "nutritionBasisAmount">,
): number | null {
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
  if (ingredient.baseDimension === "count") return unitPrice * ingredient.nutritionBasisAmount;
  const factor = smallestUnitFactors[ingredient.baseUnit.toLowerCase()];
  if (factor === undefined) return null;
  return (unitPrice * ingredient.nutritionBasisAmount * factor) / 100;
}

/** Linked prices older than this are refreshed from Inventia when the ingredient is viewed. */
export const inventiaPriceMaxAgeMs = 24 * 60 * 60 * 1000;
/** A linked item without any price record is re-checked sooner so a newly recorded price shows up. */
export const inventiaMissingPriceRetryMs = 60 * 60 * 1000;

/** Whether a linked ingredient's cached Inventia price should be refreshed. */
export function isInventiaPriceStale(
  ingredient: Pick<Ingredient, "inventiaItemId" | "latestUnitPriceYen" | "latestPriceUpdatedAt"> &
    Partial<Pick<Ingredient, "latestPriceAttemptedAt">>,
  now: Date,
): boolean {
  if (!ingredient.inventiaItemId) return false;
  // A recent attempt (even a failed one) waits for the retry window.
  const attemptedAt = ingredient.latestPriceAttemptedAt
    ? Date.parse(ingredient.latestPriceAttemptedAt)
    : Number.NaN;
  if (!Number.isNaN(attemptedAt) && now.getTime() - attemptedAt < inventiaMissingPriceRetryMs)
    return false;
  if (!ingredient.latestPriceUpdatedAt) return true;
  const checkedAt = Date.parse(ingredient.latestPriceUpdatedAt);
  if (Number.isNaN(checkedAt)) return true;
  const maxAge =
    ingredient.latestUnitPriceYen === null ? inventiaMissingPriceRetryMs : inventiaPriceMaxAgeMs;
  return now.getTime() - checkedAt >= maxAge;
}

export const dishSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(64).nullable().default(null),
    servings: z.int().min(1).max(100),
    recipe: recipeSchema,
    totalNutrition: nutritionFactsSchema.nullable().default(null),
    /** Per-serving cost of the priced ingredients; null when none has a price. */
    totalCostYen: z.number().min(0).nullable().default(null),
    /** How many ingredients have no price (so totalCostYen is a lower bound when above 0). */
    costMissingCount: z.int().min(0).default(0),
    coverImageId: imageIdSchema.nullable().default(null),
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
export interface DishCostBreakdown {
  /** Sum over the ingredients that have a price, divided by servings (yen per serving). */
  totalYen: number;
  /** Ingredient IDs (one per recipe entry, in order) that could not be priced. */
  missingIngredientIds: string[];
  missingCount: number;
  /** True when every ingredient was priced. */
  complete: boolean;
}

/**
 * Per-serving cost of a dish. Unpriced ingredients are skipped and reported, so `totalYen` is a
 * lower bound unless `complete`.
 */
export function calculateDishCost(
  ingredients: readonly { ingredient: Ingredient; amount: number }[],
  servings = 1,
): DishCostBreakdown {
  if (!Number.isInteger(servings) || servings < 1)
    throw new RangeError("Servings must be a positive integer");
  let total = 0;
  const missingIngredientIds: string[] = [];
  for (const { ingredient, amount } of ingredients) {
    const cost = calculateIngredientCost(ingredient, amount);
    if (cost === null) missingIngredientIds.push(ingredient.id);
    else total += cost;
  }
  return {
    totalYen: total / servings,
    missingIngredientIds,
    missingCount: missingIngredientIds.length,
    complete: missingIngredientIds.length === 0,
  };
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
    ingredientCostBreakdown: z.array(ingredientCostBreakdownEntrySchema).max(100).default([]),
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
    items: z.array(mealLogItemSchema).min(1).max(100),
  })
  .strict();
export type MealLog = z.infer<typeof mealLogSchema>;

export const mealPeriodTotalsSchema = z
  .object({
    priceYen: z.number(),
    caloriesKcal: z.number().nullable(),
    proteinG: z.number().nullable(),
    fatG: z.number().nullable(),
    carbohydrateG: z.number().nullable(),
    fiberG: z.number().nullable(),
    saltEquivalentG: z.number().nullable(),
  })
  .strict();
export type MealPeriodTotals = z.infer<typeof mealPeriodTotalsSchema>;
export const mealSummarySchema = z
  .object({
    day: mealPeriodTotalsSchema,
    week: mealPeriodTotalsSchema,
    month: mealPeriodTotalsSchema,
  })
  .strict();
export type MealSummary = z.infer<typeof mealSummarySchema>;
export const mealListSchema = z
  .object({ meals: z.array(mealLogSchema), summary: mealSummarySchema })
  .strict();
export type MealList = z.infer<typeof mealListSchema>;
