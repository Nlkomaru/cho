import { z } from "zod";
import { nutritionFactsSchema } from "./nutrition";
import { recipeSchema } from "./recipe";

export const mcpToolNames = [
  "list_ingredients",
  "create_ingredient",
  "update_ingredient",
  "delete_ingredient",
  "list_recipes",
  "create_recipe",
  "delete_recipe",
  "calculate_purchase_list",
  "record_meal",
] as const;

export const mcpToolNameSchema = z.enum(mcpToolNames);
export type McpToolName = z.infer<typeof mcpToolNameSchema>;

export const updateIngredientInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    ingredientId: z.string().trim().min(1).optional(),
    inventiaItemId: z.string().trim().min(1).max(128).nullable().optional(),
    inventia_item_id: z.string().trim().min(1).max(128).nullable().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    baseDimension: z.enum(["mass", "volume", "count"]).optional(),
    baseUnit: z.string().trim().min(1).max(50).optional(),
    nutritionBasisAmount: z.number().positive().optional(),
    nutritionPerBasis: nutritionFactsSchema.optional(),
    gramPerUnit: z.number().positive().nullable().optional(),
    memo: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.ingredientId), {
    message: "Either id or ingredientId must be provided",
  });

export type UpdateIngredientInput = z.infer<typeof updateIngredientInputSchema>;

export const deleteRecipeInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    recipeId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.recipeId), {
    message: "Either id or recipeId must be provided",
  });

export type DeleteRecipeInput = z.infer<typeof deleteRecipeInputSchema>;

export const deleteIngredientInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    ingredientId: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.ingredientId), {
    message: "Either id or ingredientId must be provided",
  });

export type DeleteIngredientInput = z.infer<typeof deleteIngredientInputSchema>;

export const deleteResultSchema = z
  .object({
    success: z.boolean(),
    deletedId: z.string(),
  })
  .strict();

export type DeleteResult = z.infer<typeof deleteResultSchema>;

export const purchaseListItemSchema = z
  .object({
    ingredientId: z.string().nullable(),
    name: z.string(),
    requiredAmount: z.number(),
    unit: z.string(),
    stockQuantity: z.number().nullable(),
    stockPresence: z.enum(["sufficient", "partial", "none", "unknown"]),
    shortageAmount: z.number(),
    purchaseAmount: z.number(),
    unitPriceYen: z.number().nullable(),
    estimatedCostYen: z.number().nullable(),
    isUnregistered: z.boolean(),
  })
  .strict();

export type PurchaseListItem = z.infer<typeof purchaseListItemSchema>;

export const purchaseListResultSchema = z
  .object({
    items: z.array(purchaseListItemSchema),
    totalEstimatedCostYen: z.number().nullable(),
    markdownTable: z.string(),
  })
  .strict();

export type PurchaseListResult = z.infer<typeof purchaseListResultSchema>;

export const inventoryItemInputSchema = z.union([
  z.number(),
  z.object({
    currentQuantity: z.number(),
    baseUnit: z.string().optional(),
  }),
]);

export const calculatePurchaseListInputSchema = z
  .object({
    dishId: z.string().trim().min(1).optional(),
    recipeId: z.string().trim().min(1).optional(),
    recipe: recipeSchema.optional(),
    inventory: z.record(z.string(), inventoryItemInputSchema).optional(),
    inventoryOverrides: z.record(z.string(), inventoryItemInputSchema).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.dishId || data.recipeId || data.recipe), {
    message: "Either dishId, recipeId, or recipe must be provided",
  });

export type CalculatePurchaseListInput = z.infer<typeof calculatePurchaseListInputSchema>;
