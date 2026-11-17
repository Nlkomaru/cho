import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { foodSchema } from "../domain/ingredient";
import { createDbClient } from "../db/client";
import { createFoodRepository } from "../repositories/food-repository";
import type { ApiBindings } from "./index";

const errorSchema = z.object({ error: z.string() }).strict();
const foodInputSchema = foodSchema.omit({ id: true }).strict();
const foodPatchSchema = foodInputSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");
const foodIdParamsSchema = z.object({ id: foodSchema.shape.id }).strict();

export const foodRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const listFoodsRoute = createRoute({
  method: "get",
  path: "/api/foods",
  summary: "List foods",
  responses: {
    200: {
      description: "Staple foods list.",
      content: { "application/json": { schema: z.array(foodSchema) } },
    },
  },
});

foodRoutes.openapi(listFoodsRoute, async (context) => {
  const repository = createFoodRepository(createDbClient(context.env.DB));
  return context.json(await repository.list(), 200);
});

const createFoodRoute = createRoute({
  method: "post",
  path: "/api/foods",
  summary: "Create a food",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: foodInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Created food.",
      content: { "application/json": { schema: foodSchema } },
    },
    400: {
      description: "Invalid food input.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Unable to create food.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

foodRoutes.openapi(createFoodRoute, async (context) => {
  const input = context.req.valid("json");
  const repository = createFoodRepository(createDbClient(context.env.DB));
  try {
    const food = await repository.create({
      ...input,
      id: crypto.randomUUID(),
    });
    return context.json(food, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return context.json({ error: "Invalid food input." }, 400);
    }
    return context.json({ error: "Unable to create food." }, 500);
  }
});

const getFoodRoute = createRoute({
  method: "get",
  path: "/api/foods/{id}",
  summary: "Get a food",
  request: { params: foodIdParamsSchema },
  responses: {
    200: {
      description: "Food details.",
      content: { "application/json": { schema: foodSchema } },
    },
    404: {
      description: "Food not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

foodRoutes.openapi(getFoodRoute, async (context) => {
  const { id } = context.req.valid("param");
  const repository = createFoodRepository(createDbClient(context.env.DB));
  const food = await repository.getById(id);
  if (!food) return context.json({ error: "Food not found." }, 404);
  return context.json(food, 200);
});

const updateFoodRoute = createRoute({
  method: "patch",
  path: "/api/foods/{id}",
  summary: "Update a food",
  request: {
    params: foodIdParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: foodPatchSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated food.",
      content: { "application/json": { schema: foodSchema } },
    },
    400: {
      description: "Invalid food input.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Food not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Unable to update food.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

foodRoutes.openapi(updateFoodRoute, async (context) => {
  const { id } = context.req.valid("param");
  const changes = context.req.valid("json");
  const repository = createFoodRepository(createDbClient(context.env.DB));
  try {
    const updated = await repository.update(id, changes);
    if (!updated) return context.json({ error: "Food not found." }, 404);
    return context.json(updated, 200);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return context.json({ error: "Invalid food input." }, 400);
    }
    return context.json({ error: "Unable to update food." }, 500);
  }
});

const deleteFoodRoute = createRoute({
  method: "delete",
  path: "/api/foods/{id}",
  summary: "Delete a food",
  request: { params: foodIdParamsSchema },
  responses: {
    204: { description: "Food deleted." },
    404: {
      description: "Food not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

foodRoutes.openapi(deleteFoodRoute, async (context) => {
  const { id } = context.req.valid("param");
  const repository = createFoodRepository(createDbClient(context.env.DB));
  const deleted = await repository.delete(id);
  if (!deleted) return context.json({ error: "Food not found." }, 404);
  return context.body(null, 204);
});
