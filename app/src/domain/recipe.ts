import { z } from "zod";

const recipeIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]{1,64}$/);
export const recipeIngredientEntrySchema = z
  .object({
    id: recipeIdSchema.describe("Recipe-local ingredient ID"),
    ingredientId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(120),
    amount: z.number().positive(),
    unit: z.string().trim().min(1).max(50),
    displayAmount: z.string().trim().min(1).max(64),
    role: z.enum(["main", "seasoning", "topping", "optional"]).default("main"),
    groupId: recipeIdSchema.nullable().default(null),
    prepNote: z.string().trim().max(120).nullable().default(null),
  })
  .strict();

export const recipeGroupSymbolSchema = z.enum(["★", "☆", "◎", "●", "▲", "A", "B", "C"]);
export const recipeIngredientGroupSchema = z
  .object({
    id: recipeIdSchema,
    symbol: recipeGroupSymbolSchema,
    label: z.string().trim().min(1).max(64),
    ingredientEntryIds: z.array(recipeIdSchema).min(1),
  })
  .strict();

export const recipeStepIngredientInputSchema = z
  .object({
    type: z.literal("ingredient"),
    ingredientEntryId: recipeIdSchema,
    amountRatio: z.number().min(0.01).max(1).default(1),
    amountText: z.string().trim().max(64).nullable().default(null),
  })
  .strict();
export const recipeStepGroupInputSchema = z
  .object({ type: z.literal("group"), groupId: recipeIdSchema })
  .strict();
export const recipeStepIntermediateInputSchema = z
  .object({
    type: z.literal("intermediate"),
    fromStepId: recipeIdSchema,
    outputId: recipeIdSchema,
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
    activeDurationSec: z.int().min(0).max(86400),
    passiveDurationSec: z.int().min(0).max(604800).default(0),
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
    dependsOnStepIds: z.array(recipeIdSchema).default([]),
    resourceTags: z.array(z.string().trim().min(1).max(64)).default([]),
    heatLevel: z
      .enum(["none", "low", "medium_low", "medium", "medium_high", "high", "boil", "simmer"])
      .default("none"),
    targetTempCelsius: z.number().min(-50).max(350).nullable().default(null),
    inputs: z.array(recipeStepInputSchema).default([]),
    outputs: z.array(recipeStepOutputSchema).default([]),
    completionCue: z.string().trim().max(300).nullable().default(null),
    cautions: z.array(recipeCautionSchema).default([]),
  })
  .strict();
export const recipeSchema = z
  .object({
    schemaVersion: z.literal("1.0").default("1.0"),
    servings: z.int().min(1).max(100).default(1),
    summary: z.string().trim().max(500).nullable().default(null),
    equipment: z.array(z.string().trim().min(1).max(100)).default([]),
    ingredientGroups: z.array(recipeIngredientGroupSchema).default([]),
    ingredients: z.array(recipeIngredientEntrySchema).min(1).max(100),
    steps: z.array(recipeStepSchema).min(1).max(100),
    globalCautions: z.array(recipeCautionSchema).default([]),
  })
  .strict();
export type RecipeJson = z.infer<typeof recipeSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeIngredientEntry = z.infer<typeof recipeIngredientEntrySchema>;
export type RecipeIngredientGroup = z.infer<typeof recipeIngredientGroupSchema>;
export const recipeJsonSchema = z.toJSONSchema(recipeSchema, { target: "draft-2020-12" });
