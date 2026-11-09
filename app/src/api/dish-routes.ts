import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { dishSchema } from "../domain/ingredient";
import { inventoryItemInputSchema, purchaseListResultSchema } from "../domain/mcp";
import { calculatePurchaseList } from "../domain/purchase-list";
import { computeRecipeGanttSchedule } from "../domain/recipe-scheduler";
import { createDbClient } from "../db/client";
import { createDishRepository, DishImageError } from "../repositories/dish-repository";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createSettingsRepository } from "../repositories/settings-repository";
import { createDishService } from "../services/dish";
import { resolveInventiaConnection } from "../services/integration-settings";
import type { ApiBindings } from "./index";

const errorSchema = z.object({ error: z.string() }).strict();
const dishInputSchema = dishSchema.omit({
  id: true,
  totalNutrition: true,
  totalCostYen: true,
  costMissingCount: true,
});
const dishPatchSchema = dishInputSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");
const dishDetailSchema = z
  .object({
    dish: dishSchema,
    schedule: z
      .object({
        totalDurationSec: z.number(),
        serialDurationSec: z.number(),
        savedDurationSec: z.number(),
        lanes: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
        bars: z.array(
          z
            .object({
              stepId: z.string(),
              stepNumber: z.number(),
              title: z.string(),
              laneId: z.string(),
              laneLabel: z.string(),
              startSec: z.number(),
              activeEndSec: z.number(),
              endSec: z.number(),
              dependsOnStepIds: z.array(z.string()),
              inputsSummary: z.array(z.string()),
              outputLabel: z.string().nullable(),
              isCriticalPath: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const dishRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const listDishesRoute = createRoute({
  method: "get",
  path: "/api/dishes",
  summary: "List dishes",
  responses: {
    200: {
      description: "Dish list.",
      content: { "application/json": { schema: z.array(dishSchema) } },
    },
  },
});
dishRoutes.openapi(listDishesRoute, async (context) => {
  const { service } = createDishContext(context.env);
  return context.json(await service.list(), 200);
});

const createDishRoute = createRoute({
  method: "post",
  path: "/api/dishes",
  summary: "Create a dish",
  request: {
    body: { required: true, content: { "application/json": { schema: dishInputSchema } } },
  },
  responses: {
    201: { description: "Created dish.", content: { "application/json": { schema: dishSchema } } },
    400: {
      description: "Invalid dish, recipe DAG, ingredient reference, or image reference.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Dish could not be created.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
dishRoutes.openapi(createDishRoute, async (context) => {
  const input = context.req.valid("json");
  if (input.servings !== input.recipe.servings) {
    return context.json({ error: "Dish servings must match recipe servings." }, 400);
  }
  const { service } = createDishContext(context.env);
  try {
    const dish = await service.create({ ...input, id: crypto.randomUUID() });
    return context.json(dish, 201);
  } catch (error) {
    if (error instanceof DishImageError) return context.json({ error: error.message }, 400);
    if (isDishValidationError(error)) {
      return context.json({ error: "Invalid recipe DAG or ingredient reference." }, 400);
    }
    return context.json({ error: "Dish could not be created." }, 500);
  }
});

const getDishRoute = createRoute({
  method: "get",
  path: "/api/dishes/{id}",
  summary: "Get dish details and schedule",
  request: { params: z.object({ id: dishSchema.shape.id }).strict() },
  responses: {
    200: {
      description: "Dish and computed recipe schedule.",
      content: { "application/json": { schema: dishDetailSchema } },
    },
    404: {
      description: "Dish not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Dish schedule could not be computed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
dishRoutes.openapi(getDishRoute, async (context) => {
  const { id } = context.req.valid("param");
  const { service } = createDishContext(context.env);
  const dish = await service.get(id);
  if (!dish) return context.json({ error: "Dish not found." }, 404);
  const ingredients = await service.ingredientsFor([dish.recipe]);
  try {
    return context.json(
      { dish, schedule: computeRecipeGanttSchedule(dish.recipe, ingredients) },
      200,
    );
  } catch {
    return context.json({ error: "Dish schedule could not be computed." }, 500);
  }
});

const updateDishRoute = createRoute({
  method: "patch",
  path: "/api/dishes/{id}",
  summary: "Update a dish",
  request: {
    params: z.object({ id: dishSchema.shape.id }).strict(),
    body: { required: true, content: { "application/json": { schema: dishPatchSchema } } },
  },
  responses: {
    200: { description: "Updated dish.", content: { "application/json": { schema: dishSchema } } },
    400: {
      description: "Invalid dish, recipe DAG, ingredient reference, or image reference.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Dish not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Dish could not be updated.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
dishRoutes.openapi(updateDishRoute, async (context) => {
  const { id } = context.req.valid("param");
  const changes = context.req.valid("json");
  const { service } = createDishContext(context.env);
  const current = await service.get(id);
  if (!current) return context.json({ error: "Dish not found." }, 404);

  const recipe = changes.recipe ?? current.recipe;
  const servings = changes.servings ?? current.servings;
  if (servings !== recipe.servings) {
    return context.json({ error: "Dish servings must match recipe servings." }, 400);
  }
  try {
    const dish = await service.update(id, { ...changes, servings, recipe });
    if (!dish) return context.json({ error: "Dish not found." }, 404);
    return context.json(dish, 200);
  } catch (error) {
    if (error instanceof DishImageError) return context.json({ error: error.message }, 400);
    if (isDishValidationError(error)) {
      return context.json({ error: "Invalid recipe DAG or ingredient reference." }, 400);
    }
    return context.json({ error: "Dish could not be updated." }, 500);
  }
});

const deleteDishRoute = createRoute({
  method: "delete",
  path: "/api/dishes/{id}",
  summary: "Delete a dish",
  request: { params: z.object({ id: dishSchema.shape.id }).strict() },
  responses: {
    204: { description: "Dish deleted." },
    404: {
      description: "Dish not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
dishRoutes.openapi(deleteDishRoute, async (context) => {
  const { id } = context.req.valid("param");
  const { service } = createDishContext(context.env);
  const deleted = await service.delete(id);
  if (!deleted) return context.json({ error: "Dish not found." }, 404);
  return context.body(null, 204);
});

const purchaseListBodySchema = z
  .object({
    inventory: z.record(z.string(), inventoryItemInputSchema).optional(),
    inventoryOverrides: z.record(z.string(), inventoryItemInputSchema).optional(),
  })
  .strict()
  .optional();

const purchaseListRoute = createRoute({
  method: "post",
  path: "/api/dishes/{id}/purchase-list",
  summary: "Calculate purchase and shortage list for a dish",
  request: {
    params: z.object({ id: dishSchema.shape.id }).strict(),
    body: {
      content: {
        "application/json": {
          schema: purchaseListBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Purchase list calculated.",
      content: { "application/json": { schema: purchaseListResultSchema } },
    },
    404: {
      description: "Dish not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

dishRoutes.openapi(purchaseListRoute, async (context) => {
  const { id } = context.req.valid("param");
  const { service, ingredientRepository, db } = createDishContext(context.env);
  const dish = await service.get(id);
  if (!dish) return context.json({ error: "Dish not found." }, 404);

  let body: z.infer<typeof purchaseListBodySchema>;
  try {
    body = context.req.valid("json");
  } catch {
    body = undefined;
  }

  const ingredients = await ingredientRepository.list();
  const inventory: Record<string, { currentQuantity: number; baseUnit: string }> = {};

  try {
    const settings = await createSettingsRepository(db).get("inventia");
    const { client } = await resolveInventiaConnection(settings, context.env);
    if (client) {
      for (const entry of dish.recipe.ingredients) {
        if (entry.ingredientId) {
          const ing = ingredients.find((i) => i.id === entry.ingredientId);
          if (ing?.inventiaItemId) {
            try {
              const item = await client.getItem(ing.inventiaItemId);
              if (item && item.currentQuantity !== null) {
                inventory[entry.ingredientId] = {
                  currentQuantity: item.currentQuantity,
                  baseUnit: item.baseUnit,
                };
              }
            } catch {
              // ignore individual lookup error
            }
          }
        }
      }
    }
  } catch {
    // Inventia not available; ignore
  }

  const rawInventory = {
    ...body?.inventory,
    ...body?.inventoryOverrides,
  };
  for (const [key, val] of Object.entries(rawInventory)) {
    if (typeof val === "number") {
      inventory[key] = { currentQuantity: val, baseUnit: "" };
    } else if (val && typeof val === "object") {
      inventory[key] = {
        currentQuantity: val.currentQuantity,
        baseUnit: val.baseUnit ?? "",
      };
    }
  }

  const result = calculatePurchaseList({
    recipe: dish.recipe,
    ingredients,
    inventory,
  });

  return context.json(result, 200);
});

function createDishContext(env: ApiBindings) {
  const db = createDbClient(env.DB);
  const repository = createDishRepository(db);
  const ingredientRepository = createIngredientRepository(db);
  return {
    service: createDishService({ repository, ingredientRepository }),
    ingredientRepository,
    db,
  };
}

function isDishValidationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith("Invalid recipe DAG:") ||
      error.message.startsWith("Unknown ingredient "))
  );
}
