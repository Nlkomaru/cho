import { z } from "zod";

const recipeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]{1,64}$/);
/** Images come from POST /api/images/upload or the MCP upload tools, which issue random UUIDs. */
export const imageIdSchema = z
  .uuid()
  .describe("Image UUID from upload_image, create_image_upload, or POST /api/images/upload");
export const MAX_STEP_IMAGES = 4;
/** Cover plus every step image; keeps one `IN (...)` lookup well under the D1 bound-parameter limit. */
export const MAX_DISH_IMAGES = 40;

/** Shown when an entry has no label and its ingredient is missing from the master. */
export const UNKNOWN_INGREDIENT_NAME = "不明な材料";

export const recipeIngredientEntryObjectSchema = z
  .object({
    id: recipeIdSchema.describe("Recipe-local ingredient ID"),
    ingredientId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .describe(
        "UUID of an existing Cho ingredient, taken from list_ingredients or create_ingredient",
      ),
    label: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .nullable()
      .default(null)
      .describe(
        "Optional recipe-specific wording shown instead of the ingredient name, such as 玉ねぎ（飾り用）. Use null to show the ingredient's registered name",
      ),
    amount: z
      .number()
      .positive()
      .describe("Amount in the ingredient base unit (g for mass, mL for volume, pieces for count)"),
    unit: z.string().trim().min(1).max(50),
    displayAmount: z.string().trim().min(1).max(64),
    role: z.enum(["main", "seasoning", "topping", "optional"]).default("main"),
    groupId: recipeIdSchema
      .nullable()
      .default(null)
      .describe("ID of an entry in ingredientGroups, or null"),
    prepNote: z.string().trim().max(120).nullable().default(null),
  })
  .strict();

/**
 * Entries used to store a copy of the ingredient name in `name`. Without a `label` key it is
 * read as the label (one that matches the master name is dropped when the recipe is saved).
 * With a `label` key, `name` is the read-only display name from an output and is ignored.
 * A blank label means "use the master name".
 */
function readLegacyEntry(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const { name, ...rest } = value as Record<string, unknown>;
  const label = "label" in rest ? rest.label : name;
  if (label === undefined) return rest;
  return { ...rest, label: typeof label === "string" && !label.trim() ? null : label };
}

export const recipeIngredientEntrySchema = z.preprocess(
  readLegacyEntry,
  recipeIngredientEntryObjectSchema,
);

export const recipeGroupSymbolSchema = z.enum(["★", "☆", "◎", "●", "▲", "A", "B", "C"]);
export const recipeIngredientGroupSchema = z
  .object({
    id: recipeIdSchema,
    symbol: recipeGroupSymbolSchema,
    label: z.string().trim().min(1).max(64),
    ingredientEntryIds: z
      .array(recipeIdSchema)
      .min(1)
      .max(100)
      .describe("Recipe-local ingredient entry IDs (ingredients[].id) that belong to this group"),
  })
  .strict();

export const recipeStepIngredientInputSchema = z
  .object({
    type: z.literal("ingredient"),
    ingredientEntryId: recipeIdSchema.describe("Recipe-local ID of an entry in recipe.ingredients"),
    amountRatio: z.number().min(0.01).max(1).default(1),
    amountText: z.string().trim().max(64).nullable().default(null),
  })
  .strict();
export const recipeStepGroupInputSchema = z
  .object({
    type: z.literal("group"),
    groupId: recipeIdSchema.describe("Recipe-local ID of an entry in recipe.ingredientGroups"),
  })
  .strict();
export const recipeStepIntermediateInputSchema = z
  .object({
    type: z.literal("intermediate"),
    fromStepId: recipeIdSchema.describe("ID of the earlier step that produces this output"),
    outputId: recipeIdSchema.describe("ID of an entry in that step's outputs"),
  })
  .strict();
export const recipeStepInputSchema = z.discriminatedUnion("type", [
  recipeStepIngredientInputSchema,
  recipeStepGroupInputSchema,
  recipeStepIntermediateInputSchema,
]);
export const recipeStepOutputSchema = z
  .object({
    id: recipeIdSchema,
    label: z.string().trim().min(1).max(120),
  })
  .strict();
export const recipeCautionSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    category: z.enum(["safety", "quality", "timing", "substitution", "storage"]),
    severity: z.enum(["info", "warning", "critical"]),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000),
    triggerCondition: z.string().trim().max(200).nullable().default(null),
  })
  .strict();
export const recipeStepDurationScalingSchema = z
  .enum(["fixed", "linear", "sublinear"])
  .default("fixed");
export const recipeStepTimingSchema = z
  .object({
    activeDurationSec: z
      .int()
      .min(0)
      .max(86400)
      .describe("Seconds the cook must actively work on this step"),
    passiveDurationSec: z
      .int()
      .min(0)
      .max(604800)
      .default(0)
      .describe("Seconds of waiting with no work, such as simmering or resting"),
    minTotalDurationSec: z.int().min(0).max(604800).nullable().default(null),
    maxTotalDurationSec: z.int().min(0).max(604800).nullable().default(null),
    scalingMode: recipeStepDurationScalingSchema,
    timerLabel: z.string().trim().max(64).nullable().default(null),
  })
  .strict();
export const recipeStepSchema = z
  .object({
    id: recipeIdSchema,
    stepNumber: z.int().min(1).max(200),
    phase: z.enum(["prep", "cook", "assemble", "finish", "cleanup"]),
    title: z.string().trim().min(1).max(120),
    instruction: z.string().trim().min(1).max(2000),
    executionMode: z.enum(["active", "passive", "mixed"]),
    timing: recipeStepTimingSchema,
    dependsOnStepIds: z
      .array(recipeIdSchema)
      .max(50)
      .default([])
      .describe("IDs of steps that must finish before this one starts. Must not form a cycle"),
    resourceTags: z
      .array(z.string().trim().min(1).max(64))
      .max(20)
      .default([])
      .describe("Resources this step occupies, such as a burner or the oven"),
    heatLevel: z
      .enum(["none", "low", "medium_low", "medium", "medium_high", "high", "boil", "simmer"])
      .default("none"),
    targetTempCelsius: z.number().min(-50).max(350).nullable().default(null),
    inputs: z
      .array(recipeStepInputSchema)
      .max(50)
      .default([])
      .describe(
        "What this step consumes: recipe ingredients, ingredient groups, or outputs of earlier steps",
      ),
    outputs: z
      .array(recipeStepOutputSchema)
      .max(50)
      .default([])
      .describe("Intermediate products this step makes. Later steps reference them by outputId"),
    completionCue: z.string().trim().max(300).nullable().default(null),
    cautions: z.array(recipeCautionSchema).max(20).default([]),
    imageIds: z
      .array(imageIdSchema)
      .max(MAX_STEP_IMAGES)
      .default([])
      .describe("Photos shown with this step, in order. An image can be used only once per recipe"),
  })
  .strict();
export const recipeSchema = z
  .object({
    schemaVersion: z.literal("1.0").default("1.0"),
    servings: z
      .int()
      .min(1)
      .max(100)
      .default(1)
      .describe("Number of servings the amounts are written for"),
    summary: z.string().trim().max(500).nullable().default(null),
    equipment: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    ingredientGroups: z
      .array(recipeIngredientGroupSchema)
      .max(50)
      .default([])
      .describe("Optional groups of ingredients that are used together, such as a sauce"),
    ingredients: z.array(recipeIngredientEntrySchema).min(1).max(100),
    steps: z
      .array(recipeStepSchema)
      .min(1)
      .max(100)
      .describe("Ordered steps. Each step lists dependsOnStepIds; the graph must be acyclic"),
    globalCautions: z.array(recipeCautionSchema).max(50).default([]),
  })
  .strict();
export type RecipeJson = z.infer<typeof recipeSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeIngredientEntry = z.infer<typeof recipeIngredientEntrySchema>;
export type RecipeIngredientGroup = z.infer<typeof recipeIngredientGroupSchema>;

/** Anything that maps an ingredient ID to its master record, such as a Map of ingredients. */
export type IngredientNameLookup = ReadonlyMap<string, { readonly name: string }>;

/** Display name of a recipe entry: its label, else the master ingredient name. */
export function recipeEntryName(
  entry: Pick<RecipeIngredientEntry, "ingredientId" | "label">,
  ingredients: IngredientNameLookup | undefined,
): string {
  return entry.label ?? ingredients?.get(entry.ingredientId)?.name ?? UNKNOWN_INGREDIENT_NAME;
}

/** Drops labels that only repeat the master ingredient name, so renames in the master show up. */
export function dropRedundantLabels<T extends Pick<RecipeJson, "ingredients">>(
  recipe: T,
  ingredients: IngredientNameLookup,
): T {
  if (
    !recipe.ingredients.some(
      (entry) => entry.label !== null && entry.label === ingredients.get(entry.ingredientId)?.name,
    )
  )
    return recipe;
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((entry) =>
      entry.label !== null && entry.label === ingredients.get(entry.ingredientId)?.name
        ? { ...entry, label: null }
        : entry,
    ),
  };
}

/** A recipe entry with its display name filled in, for read-only outputs such as MCP results. */
export const namedRecipeIngredientEntrySchema = recipeIngredientEntryObjectSchema.extend({
  name: z
    .string()
    .describe(
      "Display name: label when set, otherwise the registered ingredient name. Read-only; change label or the ingredient to change it",
    ),
});
export type NamedRecipeIngredientEntry = z.infer<typeof namedRecipeIngredientEntrySchema>;

export function withEntryNames<T extends Pick<RecipeJson, "ingredients">>(
  recipe: T,
  ingredients: IngredientNameLookup,
): Omit<T, "ingredients"> & { ingredients: NamedRecipeIngredientEntry[] } {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((entry) => ({
      ...entry,
      name: recipeEntryName(entry, ingredients),
    })),
  };
}

export const recipeJsonSchema = z.toJSONSchema(recipeSchema, { target: "draft-2020-12" });
