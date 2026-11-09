import { z } from "zod";
import { inventiaItemIdSchema } from "./ingredient";
import { nutritionFactsSchema } from "./nutrition";
import { MAX_INLINE_IMAGE_BYTES, supportedImageTypes } from "./image";
import { imageIdSchema, MAX_STEP_IMAGES, recipeSchema, recipeStepSchema } from "./recipe";

export const mcpToolNames = [
  "list_ingredients",
  "get_ingredient",
  "create_ingredient",
  "update_ingredient",
  "delete_ingredient",
  "search_inventia_items",
  "link_inventia_item",
  "get_ingredient_stock",
  "list_recipes",
  "get_recipe",
  "create_recipe",
  "update_recipe",
  "delete_recipe",
  "upload_image",
  "create_image_upload",
  "set_recipe_images",
  "calculate_purchase_list",
  "list_meals",
  "get_meal",
  "record_meal",
  "update_meal",
  "delete_meal",
] as const;

/** Tools that existed before per-token permissions covered the newer write tools. */
export const legacyMcpToolNames = [
  "list_ingredients",
  "create_ingredient",
  "update_ingredient",
  "delete_ingredient",
  "list_recipes",
  "create_recipe",
  "delete_recipe",
  "calculate_purchase_list",
  "record_meal",
] as const satisfies readonly (typeof mcpToolNames)[number][];

export const mcpToolNameSchema = z.enum(mcpToolNames);
export type McpToolName = z.infer<typeof mcpToolNameSchema>;

const idSchema = z.string().trim().min(1).max(128);

/** True when at most one alias is set, or both are set to the same value. */
export function aliasesAgree<T>(a: T | undefined, b: T | undefined): boolean {
  return a === undefined || b === undefined || a === b;
}

export const updateIngredientInputSchema = z
  .object({
    id: idSchema.optional().describe("Ingredient ID. Preferred over the ingredientId alias"),
    ingredientId: idSchema.optional().describe("Alias of id"),
    inventiaItemId: inventiaItemIdSchema
      .nullable()
      .optional()
      .describe(
        "Inventia item ID to link, or null to unlink. A non-null value is checked against Inventia (existence and unit) and the latest price is pulled. Use search_inventia_items to find IDs",
      ),
    inventia_item_id: inventiaItemIdSchema
      .nullable()
      .optional()
      .describe("Alias of inventiaItemId"),
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
  })
  .refine((data) => aliasesAgree(data.id, data.ingredientId), {
    message: "id and ingredientId must match when both are given",
  })
  .refine((data) => aliasesAgree(data.inventiaItemId, data.inventia_item_id), {
    message: "inventiaItemId and inventia_item_id must match when both are given",
  });

export type UpdateIngredientInput = z.infer<typeof updateIngredientInputSchema>;

export const deleteRecipeInputSchema = z
  .object({
    id: idSchema.optional().describe("Recipe ID. Preferred over the recipeId alias"),
    recipeId: idSchema.optional().describe("Alias of id"),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.recipeId), {
    message: "Either id or recipeId must be provided",
  })
  .refine((data) => aliasesAgree(data.id, data.recipeId), {
    message: "id and recipeId must match when both are given",
  });

export type DeleteRecipeInput = z.infer<typeof deleteRecipeInputSchema>;

export const deleteIngredientInputSchema = z
  .object({
    id: idSchema.optional().describe("Ingredient ID. Preferred over the ingredientId alias"),
    ingredientId: idSchema.optional().describe("Alias of id"),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.ingredientId), {
    message: "Either id or ingredientId must be provided",
  })
  .refine((data) => aliasesAgree(data.id, data.ingredientId), {
    message: "id and ingredientId must match when both are given",
  });

export type DeleteIngredientInput = z.infer<typeof deleteIngredientInputSchema>;

/** Input for tools that address one record by ID. */
export const idInputSchema = z.object({ id: idSchema }).strict();
export const getIngredientInputSchema = z
  .object({
    id: idSchema.optional().describe("Ingredient ID"),
    ingredientId: idSchema.optional().describe("Alias of id"),
  })
  .strict()
  .refine((data) => Boolean(data.id || data.ingredientId), {
    message: "Either id or ingredientId must be provided",
  })
  .refine((data) => aliasesAgree(data.id, data.ingredientId), {
    message: "id and ingredientId must match when both are given",
  });
export const getRecipeInputSchema = deleteRecipeInputSchema;
export const searchInventiaItemsInputSchema = z
  .object({ query: z.string().trim().min(1).max(200).describe("Part of the item name") })
  .strict();
export const linkInventiaItemInputSchema = z
  .object({
    ingredientId: idSchema.describe("Cho ingredient ID"),
    itemId: inventiaItemIdSchema.describe("Inventia item ID from search_inventia_items"),
  })
  .strict();
export const getIngredientStockInputSchema = z.object({ ingredientId: idSchema }).strict();
const imageContentTypeSchema = z.enum(supportedImageTypes);
/** Base64 length of MAX_INLINE_IMAGE_BYTES bytes. */
const maxInlineBase64Length = Math.ceil(MAX_INLINE_IMAGE_BYTES / 3) * 4;

export const createImageUploadInputSchema = z
  .object({
    contentType: imageContentTypeSchema.describe(
      "Type of the file you will upload. The file content must match it",
    ),
  })
  .strict();
export const uploadImageInputSchema = z
  .object({
    url: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .optional()
      .describe("Public https URL of the image. Fetched by the server, up to 10 MiB"),
    data: z
      .base64()
      .max(maxInlineBase64Length)
      .optional()
      .describe(
        "Base64-encoded image bytes, up to 2 MiB decoded. Use create_image_upload for larger files",
      ),
    contentType: imageContentTypeSchema
      .optional()
      .describe("Expected type. Optional; the type is detected from the content"),
  })
  .strict()
  .refine((input) => (input.url === undefined) !== (input.data === undefined), {
    message: "Provide exactly one of url or data",
  });
export const setRecipeImagesInputSchema = z
  .object({
    recipeId: idSchema.describe("Recipe ID"),
    coverImageId: imageIdSchema
      .nullable()
      .optional()
      .describe("Cover image ID, or null to remove the cover. Omit to keep it"),
    stepImages: z
      .record(recipeStepSchema.shape.id, z.array(imageIdSchema).max(MAX_STEP_IMAGES))
      .optional()
      .describe(
        `Images per step ID (recipe.steps[].id), up to ${MAX_STEP_IMAGES} each, in display order. Listed steps are replaced; an empty array removes a step's images; other steps are unchanged`,
      ),
  })
  .strict()
  .refine((input) => input.coverImageId !== undefined || input.stepImages !== undefined, {
    message: "Provide coverImageId or stepImages",
  });

export const listMealsInputSchema = z
  .object({
    from: z.iso.datetime().optional().describe("Earliest eatenAt, ISO 8601 with offset"),
    to: z.iso.datetime().optional().describe("Latest eatenAt, ISO 8601 with offset"),
    limit: z.int().min(1).max(100).default(30),
    offset: z.int().min(0).default(0).describe("Number of meals to skip, for paging"),
  })
  .strict();

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
    inventiaStatus: z
      .enum(["used", "unavailable", "error", "not_linked"])
      .optional()
      .describe(
        "used: Inventia stock was read. unavailable: Inventia is not configured. error: a lookup failed (see warnings). not_linked: no ingredient is linked to Inventia",
      ),
    warnings: z.array(z.string()).optional(),
  })
  .strict();

export type PurchaseListResult = z.infer<typeof purchaseListResultSchema>;

export const inventoryItemInputSchema = z.union([
  z.number(),
  z.object({
    currentQuantity: z.number(),
    baseUnit: z
      .string()
      .optional()
      .describe("Ignored. Quantities are read in the ingredient base unit, with no conversion"),
  }),
]);

const inventoryRecordSchema = z
  .record(z.string().max(128), inventoryItemInputSchema)
  .refine((record) => Object.keys(record).length <= 200, {
    message: "At most 200 inventory entries are allowed",
  });

export const calculatePurchaseListInputSchema = z
  .object({
    dishId: idSchema.optional().describe("Recipe ID. Preferred over the recipeId alias"),
    recipeId: idSchema.optional().describe("Alias of dishId"),
    recipe: recipeSchema
      .optional()
      .describe("An unsaved recipe to calculate instead of a stored one"),
    inventory: inventoryRecordSchema
      .optional()
      .describe(
        "Stock on hand that overrides Inventia. Keys are a Cho ingredient ID, an Inventia item ID, or the ingredient name; values are a quantity in the ingredient base unit",
      ),
    inventoryOverrides: inventoryRecordSchema
      .optional()
      .describe("Alias of inventory; wins on key conflicts"),
  })
  .strict()
  .refine((data) => Boolean(data.dishId || data.recipeId || data.recipe), {
    message: "Either dishId, recipeId, or recipe must be provided",
  })
  .refine((data) => aliasesAgree(data.dishId, data.recipeId), {
    message: "dishId and recipeId must match when both are given",
  });

export type CalculatePurchaseListInput = z.infer<typeof calculatePurchaseListInputSchema>;
