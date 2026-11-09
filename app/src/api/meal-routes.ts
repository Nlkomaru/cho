import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { imageIdSchema } from "../domain/recipe";
import { mealListSchema, mealLogItemBaseSchema, mealLogSchema } from "../domain/ingredient";
import { createDbClient } from "../db/client";
import { createDishRepository } from "../repositories/dish-repository";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createMealLogRepository } from "../repositories/meal-log-repository";
import { createMealLogService } from "../services/meal-log";
import { createSettingsRepository } from "../repositories/settings-repository";
import { describeInventiaFailure, type InventiaClient } from "../services/inventia-client";
import {
  inventiaConfigurationMessage,
  inventiaStockWritesDisabledMessage,
  resolveInventiaConnection,
} from "../services/integration-settings";
import type { ApiBindings } from "./index";

const errorSchema = z.object({ error: z.string() }).strict();
const itemRequestSchema = mealLogItemBaseSchema
  .omit({ id: true })
  .extend({ id: z.string().trim().min(1).max(128).optional() })
  .strict();
const stockOperationResultSchema = z
  .object({
    currentQuantity: z.number(),
    allocations: z.array(z.unknown()),
  })
  .strict();
const stockConsumptionSchema = z
  .object({
    status: z.enum(["succeeded", "failed", "skipped"]),
    results: z.array(stockOperationResultSchema).default([]),
    error: z.string().nullable().default(null),
  })
  .strict();
const createMealSchema = mealLogSchema
  .omit({ id: true, inventiaConsumptionStatus: true })
  .extend({
    id: z.string().trim().min(1).max(128).optional(),
    // Stored legacy meals may hold other IDs, but new images come from the upload API.
    imageIds: z.array(imageIdSchema).default([]),
    items: z.array(itemRequestSchema).min(1),
    consumeStock: z.boolean().optional(),
  })
  .strict();
const createMealResponseSchema = mealLogSchema
  .extend({ stockConsumption: stockConsumptionSchema.optional() })
  .strict();
const listQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    sourceType: mealLogSchema.shape.sourceType.optional(),
    mealTiming: z.enum(["breakfast", "lunch", "dinner", "snack", "late_snack"]).optional(),
    q: z.string().trim().max(160).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

const patchMealSchema = mealLogSchema
  .omit({ id: true, inventiaConsumptionStatus: true })
  .extend({
    items: z.array(itemRequestSchema).min(1).optional(),
    imageIds: z.array(imageIdSchema).optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");
const mealIdParamsSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();

export const mealRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const listMealsRoute = createRoute({
  method: "get",
  path: "/api/meals",
  summary: "List meals",
  request: { query: listQuerySchema },
  responses: {
    200: {
      description: "Meals matching the filters with day/week/month aggregates.",
      content: { "application/json": { schema: mealListSchema } },
    },
    400: {
      description: "Invalid query parameters.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Meal listing failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

mealRoutes.openapi(listMealsRoute, async (context) => {
  try {
    const query = context.req.valid("query");
    return context.json(await createMealService(context.env).list(query), 200);
  } catch (error) {
    if (isInputError(error)) return context.json({ error: "Invalid meal query." }, 400);
    return context.json({ error: "Unable to list meals." }, 500);
  }
});

const createMealRoute = createRoute({
  method: "post",
  path: "/api/meals",
  summary: "Create meal",
  request: {
    body: { required: true, content: { "application/json": { schema: createMealSchema } } },
  },
  responses: {
    201: {
      description: "Meal created with item snapshots and optional stock outcome.",
      content: { "application/json": { schema: createMealResponseSchema } },
    },
    400: {
      description: "Invalid meal input or referenced item.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia stock writes are disabled.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Meal creation failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

mealRoutes.openapi(createMealRoute, async (context) => {
  try {
    const { consumeStock, ...input } = context.req.valid("json");
    if (
      consumeStock &&
      input.sourceType === "self_cooked" &&
      context.env.INVENTIA_STOCK_WRITES_ENABLED !== "true"
    )
      return context.json({ error: inventiaStockWritesDisabledMessage }, 409);
    const connection =
      consumeStock && input.sourceType === "self_cooked"
        ? await createMealInventiaContext(context.env)
        : null;
    const inventia =
      connection?.client && connection.status.providerId
        ? { client: connection.client, providerId: connection.status.providerId }
        : undefined;
    const service = createMealService(context.env, inventia);
    if (!consumeStock) {
      const meal = await service.create(input);
      return context.json(meal, 201);
    }
    const { meal, stockConsumption } = await service.createWithStock(input);
    return context.json({ ...meal, stockConsumption }, 201);
  } catch (error) {
    if (isInputError(error)) return context.json({ error: "Invalid meal input." }, 400);
    return context.json({ error: "Unable to create meal." }, 500);
  }
});

const getMealRoute = createRoute({
  method: "get",
  path: "/api/meals/{id}",
  summary: "Get meal",
  request: { params: mealIdParamsSchema },
  responses: {
    200: {
      description: "Meal details.",
      content: { "application/json": { schema: mealLogSchema } },
    },
    404: {
      description: "Meal not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Meal lookup failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
mealRoutes.openapi(getMealRoute, async (context) => {
  try {
    const { id } = context.req.valid("param");
    const meal = await createMealService(context.env).get(id);
    if (!meal) return context.json({ error: "Meal not found." }, 404);
    return context.json(meal, 200);
  } catch {
    return context.json({ error: "Unable to get meal." }, 500);
  }
});

const patchMealRoute = createRoute({
  method: "patch",
  path: "/api/meals/{id}",
  summary: "Update meal",
  request: {
    params: mealIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: patchMealSchema } } },
  },
  responses: {
    200: {
      description: "Updated meal.",
      content: { "application/json": { schema: mealLogSchema } },
    },
    400: {
      description: "Invalid meal update.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Meal not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Meal update failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
mealRoutes.openapi(patchMealRoute, async (context) => {
  try {
    const { id } = context.req.valid("param");
    const updated = await createMealService(context.env).update(id, context.req.valid("json"));
    if (!updated) return context.json({ error: "Meal not found." }, 404);
    return context.json(updated, 200);
  } catch (error) {
    if (isInputError(error)) return context.json({ error: "Invalid meal update." }, 400);
    return context.json({ error: "Unable to update meal." }, 500);
  }
});

const deleteMealRoute = createRoute({
  method: "delete",
  path: "/api/meals/{id}",
  summary: "Delete meal",
  request: { params: mealIdParamsSchema },
  responses: {
    204: { description: "Meal deleted." },
    404: {
      description: "Meal not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Meal deletion failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const consumeStockRoute = createRoute({
  method: "post",
  path: "/api/meals/{id}/consume-stock",
  summary: "Consume meal ingredients from Inventia stock",
  request: { params: mealIdParamsSchema },
  responses: {
    200: {
      description: "Stock consumption results.",
      content: { "application/json": { schema: z.array(stockOperationResultSchema) } },
    },
    400: {
      description: "Meal is not self-cooked.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Meal not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia is not configured.",
      content: { "application/json": { schema: errorSchema } },
    },
    502: {
      description: "Stock adjustment failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
mealRoutes.openapi(consumeStockRoute, async (context) => {
  if (context.env.INVENTIA_STOCK_WRITES_ENABLED !== "true")
    return context.json({ error: inventiaStockWritesDisabledMessage }, 409);
  const { id } = context.req.valid("param");
  const baseService = createMealService(context.env);
  const meal = await baseService.get(id);
  if (!meal) return context.json({ error: "Meal not found." }, 404);
  if (meal.sourceType !== "self_cooked")
    return context.json({ error: "Only self-cooked meals can consume stock." }, 400);
  const inventia = await createMealInventiaContext(context.env);
  if (!inventia.client || !inventia.status.capabilities.readItems)
    return context.json({ error: inventiaConfigurationMessage(inventia.status.issue) }, 409);
  if (!inventia.status.providerId)
    return context.json(
      {
        error:
          "Inventia Provider ID is required for stock writes. Save it in the Cho integration settings.",
      },
      409,
    );
  try {
    const results = await createMealService(context.env, {
      client: inventia.client,
      providerId: inventia.status.providerId,
    }).consumeStock(id);
    return context.json(results, 200);
  } catch (error) {
    const failure = describeInventiaFailure(error, "Unable to consume meal stock.");
    return context.json({ error: failure.error }, failure.status);
  }
});

async function createMealInventiaContext(env: ApiBindings) {
  const settings = await createSettingsRepository(createDbClient(env.DB)).get("inventia");
  return resolveInventiaConnection(settings, env);
}

mealRoutes.openapi(deleteMealRoute, async (context) => {
  try {
    const { id } = context.req.valid("param");
    const deleted = await createMealService(context.env).delete(id);
    if (!deleted) return context.json({ error: "Meal not found." }, 404);
    return context.body(null, 204);
  } catch {
    return context.json({ error: "Unable to delete meal." }, 500);
  }
});

function createMealService(
  env: ApiBindings,
  inventia?: { client: InventiaClient; providerId: string },
) {
  const db = createDbClient(env.DB);
  return createMealLogService({
    repository: createMealLogRepository(db),
    dishRepository: createDishRepository(db),
    ingredientRepository: createIngredientRepository(db),
    ...(inventia ? { inventiaClient: inventia.client, providerId: inventia.providerId } : {}),
  });
}

function isInputError(error: unknown): boolean {
  if (error instanceof z.ZodError || error instanceof TypeError) return true;
  return (
    error instanceof Error &&
    /^(Unknown dish:|Unknown ingredient:|Unknown ingredient .* referenced by dish )/.test(
      error.message,
    )
  );
}
