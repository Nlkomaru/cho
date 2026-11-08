import { z } from "zod";

import { ingredientSchema, mealLogSourceSchema } from "./ingredient";
import { nutritionFactsSchema } from "./nutrition";
import { recipeIngredientEntrySchema, recipeSchema } from "./recipe";

export const analyzeMealRequestSchema = z
  .object({
    imageIds: z.array(z.string().trim().min(1).max(128)).max(4),
    textHint: z.string().trim().optional(),
    sourceType: mealLogSourceSchema,
  })
  .strict();

export const analyzedMealItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    estimatedWeightG: z.number().min(0).nullable(),
    estimatedPriceYen: z.int().min(0).nullable(),
    nutrition: nutritionFactsSchema,
    detectedSource: z.enum(["nutrition_label", "openrouter_ai"]),
  })
  .strict();

export const mealAiAnalyzeOutputSchema = z
  .object({
    suggestedTitle: z.string().trim().min(1).max(120),
    suggestedPlaceName: z.string().trim().max(120).nullable(),
    items: z.array(analyzedMealItemSchema).min(1).max(20),
    totalPriceYen: z.int().min(0).nullable(),
    totalNutrition: nutritionFactsSchema,
  })
  .strict();

export const estimateIngredientRequestSchema = z
  .object({
    name: ingredientSchema.shape.name,
    baseDimension: ingredientSchema.shape.baseDimension,
    baseUnit: ingredientSchema.shape.baseUnit,
    imageId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const estimateIngredientOutputSchema = nutritionFactsSchema
  .extend({
    gramPerUnit: z.number().positive().optional(),
  })
  .strict();

export const structureRecipeRequestSchema = z
  .object({
    dishName: z.string().trim().min(1).max(120),
    ingredients: z.array(recipeIngredientEntrySchema),
    rawStepsText: z.string().trim().min(1),
  })
  .strict();

export const structureRecipeOutputSchema = recipeSchema;

export type AnalyzeMealRequest = z.infer<typeof analyzeMealRequestSchema>;
export type AnalyzedMealItem = z.infer<typeof analyzedMealItemSchema>;
export type MealAiAnalyzeOutput = z.infer<typeof mealAiAnalyzeOutputSchema>;
export type EstimateIngredientRequest = z.infer<typeof estimateIngredientRequestSchema>;
export type EstimateIngredientOutput = z.infer<typeof estimateIngredientOutputSchema>;
export type StructureRecipeRequest = z.infer<typeof structureRecipeRequestSchema>;
export type StructureRecipeOutput = z.infer<typeof structureRecipeOutputSchema>;
