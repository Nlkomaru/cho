import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { imageIdSchema } from "../domain/recipe";
import { mealListSchema, mealLogItemBaseSchema, mealLogSchema } from "../domain/ingredient";
import { createDbClient } from "../db/client";
import { createDishRepository } from "../repositories/dish-repository";
import { createFoodRepository } from "../repositories/food-repository";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createMealLogRepository } from "../repositories/meal-log-repository";
import { createMealLogService } from "../services/meal-log";
import type { ApiBindings } from "./index";

const errorSchema = z.object({ error: z.string() }).strict();
const itemRequestSchema = mealLogItemBaseSchema
  .omit({ id: true })
  .extend({ id: z.string().trim().min(1).max(128).optional() })
  .strict();
const createMealSchema = mealLogSchema
  .omit({ id: true })
  .extend({
    id: z.string().trim().min(1).max(128).optional(),
    // Stored legacy meals may hold other IDs, but new images come from the upload API.
    imageIds: z.array(imageIdSchema).default([]),
    items: z.array(itemRequestSchema).min(1),
  })
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
  .omit({ id: true })
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
      description: "Meal created with item snapshots.",
      content: { "application/json": { schema: mealLogSchema } },
    },
    400: {
      description: "Invalid meal input or referenced item.",
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
    const input = context.req.valid("json");
    const meal = await createMealService(context.env).create(input);
    return context.json(meal, 201);
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

function createMealService(env: ApiBindings) {
  const db = createDbClient(env.DB);
  return createMealLogService({
    repository: createMealLogRepository(db),
    dishRepository: createDishRepository(db),
    ingredientRepository: createIngredientRepository(db),
    foodRepository: createFoodRepository(db),
  });
}

function isInputError(error: unknown): boolean {
  if (error instanceof z.ZodError || error instanceof TypeError) return true;
  return (
    error instanceof Error &&
    /^(Unknown dish:|Unknown ingredient:|Unknown food:|Unknown ingredient .* referenced by dish )/.test(
      error.message,
    )
  );
}
