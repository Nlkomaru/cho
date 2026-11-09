import { z } from "zod";

import {
  analyzeMealRequestSchema,
  estimateIngredientRequestSchema,
  estimateIngredientOutputSchema,
  mealAiAnalyzeOutputSchema,
  structureRecipeRequestSchema,
  structureRecipeOutputSchema,
  type AnalyzeMealRequest,
  type EstimateIngredientRequest,
  type StructureRecipeRequest,
} from "../domain/ai-estimation";
import { recipeStepSchema } from "../domain/recipe";
import { validateRecipeDag } from "../domain/recipe-scheduler";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.7-flash";

type OpenRouterOptions = {
  apiKey: string;
  model?: string;
};

// The model never sees step images: image IDs must come from real uploads.
const aiRecipeSchema = structureRecipeOutputSchema.extend({
  steps: z
    .array(recipeStepSchema.omit({ imageIds: true }))
    .min(1)
    .max(100),
});

export type DataUrlImage = {
  dataUrl: string;
};

export async function analyzeMeal(
  request: AnalyzeMealRequest,
  options: OpenRouterOptions,
  images: readonly DataUrlImage[] = [],
) {
  const input = analyzeMealRequestSchema.parse(request);
  if (images.length > 4) throw new Error("Meal analysis accepts at most four images.");
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Analyze this meal. Return the requested structured output.\n${JSON.stringify(input)}`,
    },
  ];
  for (const image of images) content.push(imageContent(image));
  return completeStructured(options, "analyze_meal", mealAiAnalyzeOutputSchema, [
    { role: "user", content },
  ]);
}

export async function estimateIngredient(
  request: EstimateIngredientRequest,
  options: OpenRouterOptions,
  image?: DataUrlImage,
) {
  const input = estimateIngredientRequestSchema.parse(request);
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Estimate nutrition per basis for this ingredient. Return the requested structured output.\n${JSON.stringify(input)}`,
    },
  ];
  if (image) content.push(imageContent(image));
  return completeStructured(options, "estimate_ingredient", estimateIngredientOutputSchema, [
    { role: "user", content },
  ]);
}

export async function structureRecipe(request: StructureRecipeRequest, options: OpenRouterOptions) {
  const input = structureRecipeRequestSchema.parse(request);
  const recipe = await completeStructured(options, "structure_recipe", aiRecipeSchema, [
    {
      role: "user",
      content: `Structure these recipe instructions as a dependency DAG. Return the requested structured output.\n${JSON.stringify(input)}`,
    },
  ]);
  const validation = validateRecipeDag(recipe);
  if (!validation.success || !validation.data) {
    throw new Error(`OpenRouter returned an invalid recipe DAG: ${validation.errors.join("; ")}`);
  }
  return validation.data;
}

async function completeStructured<T>(
  options: OpenRouterOptions,
  schemaName: string,
  schema: z.ZodType<T>,
  messages: readonly { role: "user"; content: string | Array<Record<string, unknown>> }[],
): Promise<T> {
  if (!options.apiKey) throw new Error("An OpenRouter API key is required.");
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENROUTER_MODEL,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: z.toJSONSchema(schema, { target: "draft-2020-12" }),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with HTTP ${response.status}.`);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error("OpenRouter returned a malformed response envelope.");
  }
  const envelope = z
    .object({
      choices: z.array(
        z.object({
          message: z.object({ content: z.string().nullable().optional() }),
        }),
      ),
    })
    .safeParse(responseBody);
  if (!envelope.success || envelope.data.choices.length === 0) {
    throw new Error("OpenRouter response is missing choices or a valid message.");
  }
  const responseContent = envelope.data.choices[0].message.content;
  if (typeof responseContent !== "string" || !responseContent.trim()) {
    throw new Error("OpenRouter response is missing message content.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(responseContent);
  } catch {
    throw new Error("OpenRouter returned malformed JSON content.");
  }
  return schema.parse(parsedJson);
}

function imageContent(image: DataUrlImage): Record<string, unknown> {
  if (!image.dataUrl.startsWith("data:image/") || !image.dataUrl.includes(",")) {
    throw new Error("OpenRouter image must be a valid image data URL.");
  }
  return {
    type: "image_url",
    image_url: { url: image.dataUrl },
  };
}
