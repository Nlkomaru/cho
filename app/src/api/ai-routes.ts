import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import {
  analyzeMealRequestSchema,
  estimateIngredientOutputSchema,
  estimateIngredientRequestSchema,
  mealAiAnalyzeOutputSchema,
  structureRecipeOutputSchema,
  structureRecipeRequestSchema,
} from "../domain/ai-estimation";
import { createDbClient } from "../db/client";
import { createMediaImageRepository } from "../repositories/media-image-repository";
import { createSettingsRepository } from "../repositories/settings-repository";
import { decryptSecret } from "../services/crypto";
import {
  analyzeMeal,
  DEFAULT_OPENROUTER_MODEL,
  estimateIngredient,
  structureRecipe,
} from "../services/openrouter";
import type { ApiBindings } from "./index";

const errorResponseSchema = z.object({ error: z.string() }).strict();

export const aiRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const analyzeMealRoute = createRoute({
  method: "post",
  path: "/api/ai/analyze-meal",
  summary: "Analyze a meal",
  description: "Analyze meal text and optional uploaded images using OpenRouter.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: analyzeMealRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Structured meal analysis.",
      content: { "application/json": { schema: mealAiAnalyzeOutputSchema } },
    },
    400: {
      description: "Missing AI configuration.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "An image was not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    415: {
      description: "An uploaded object is not an image.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "The AI provider request failed.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

aiRoutes.openapi(analyzeMealRoute, async (context) => {
  const request = context.req.valid("json");
  const config = await getOpenRouterConfig(context.env);
  if (!config) return context.json({ error: "OpenRouter is not configured." }, 400);

  try {
    const images = await loadImages(context.env, request.imageIds);
    const result = await analyzeMeal(request, config, images);
    return context.json(result, 200);
  } catch (error) {
    if (error instanceof ImageInputError) {
      return context.json({ error: error.message }, error.status);
    }
    return context.json({ error: "AI analysis failed." }, 502);
  }
});

const estimateIngredientRoute = createRoute({
  method: "post",
  path: "/api/ai/estimate-ingredient",
  summary: "Estimate ingredient nutrition",
  description: "Estimate nutrition per basis for an ingredient, optionally using an image.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: estimateIngredientRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Ingredient nutrition estimate.",
      content: { "application/json": { schema: estimateIngredientOutputSchema } },
    },
    400: {
      description: "Missing AI configuration.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "The image was not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    415: {
      description: "The uploaded object is not an image.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "The AI provider request failed.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

aiRoutes.openapi(estimateIngredientRoute, async (context) => {
  const request = context.req.valid("json");
  const config = await getOpenRouterConfig(context.env);
  if (!config) return context.json({ error: "OpenRouter is not configured." }, 400);

  try {
    const image = request.imageId
      ? (await loadImages(context.env, [request.imageId]))[0]
      : undefined;
    const result = await estimateIngredient(request, config, image);
    return context.json(result, 200);
  } catch (error) {
    if (error instanceof ImageInputError) {
      return context.json({ error: error.message }, error.status);
    }
    return context.json({ error: "AI estimation failed." }, 502);
  }
});

const structureRecipeRoute = createRoute({
  method: "post",
  path: "/api/ai/structure-recipe",
  summary: "Structure a recipe",
  description: "Convert recipe instructions into a validated recipe dependency DAG.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: structureRecipeRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Structured recipe DAG.",
      content: { "application/json": { schema: structureRecipeOutputSchema } },
    },
    400: {
      description: "Missing AI configuration.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    502: {
      description: "The AI provider request failed or returned an invalid DAG.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

aiRoutes.openapi(structureRecipeRoute, async (context) => {
  const request = context.req.valid("json");
  const config = await getOpenRouterConfig(context.env);
  if (!config) return context.json({ error: "OpenRouter is not configured." }, 400);

  try {
    const result = await structureRecipe(request, config);
    return context.json(result, 200);
  } catch {
    return context.json({ error: "Recipe structuring failed." }, 502);
  }
});

async function getOpenRouterConfig(
  env: ApiBindings,
): Promise<{ apiKey: string; model: string } | null> {
  if (!env.SETTINGS_ENCRYPTION_KEY) return null;
  const repository = createSettingsRepository(createDbClient(env.DB));
  const settings = await repository.get("openrouter");
  if (!settings) return null;

  try {
    const apiKey = await decryptSecret(settings.encryptedPayload, env.SETTINGS_ENCRYPTION_KEY);
    const publicConfig = settings.publicConfig;
    const model =
      publicConfig &&
      typeof publicConfig === "object" &&
      "model" in publicConfig &&
      typeof publicConfig.model === "string" &&
      publicConfig.model.trim()
        ? publicConfig.model
        : DEFAULT_OPENROUTER_MODEL;
    return { apiKey, model };
  } catch {
    return null;
  }
}

async function loadImages(env: ApiBindings, imageIds: readonly string[]) {
  const db = createDbClient(env.DB);
  const repository = createMediaImageRepository(db);
  return Promise.all(
    imageIds.map(async (imageId) => {
      const metadata = await repository.getById(imageId);
      if (!metadata) throw new ImageInputError("Image not found.", 404);
      const object = await env.IMAGES_BUCKET.get(metadata.objectKey);
      if (!object) throw new ImageInputError("Image not found.", 404);
      const contentType = object.httpMetadata?.contentType ?? metadata.contentType;
      if (!contentType.toLowerCase().startsWith("image/")) {
        throw new ImageInputError("Stored object is not an image.", 415);
      }
      const bytes = new Uint8Array(await object.arrayBuffer());
      return { dataUrl: `data:${contentType};base64,${encodeBase64(bytes)}` };
    }),
  );
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

class ImageInputError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 415,
  ) {
    super(message);
  }
}
