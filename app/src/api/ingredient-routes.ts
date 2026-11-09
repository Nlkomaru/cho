import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { ingredientSchema } from "../domain/ingredient";
import { nutritionFactsSchema } from "../domain/nutrition";
import { createDbClient } from "../db/client";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createSettingsRepository } from "../repositories/settings-repository";
import { createIngredientService } from "../services/ingredient";
import { describeInventiaFailure } from "../services/inventia-client";
import {
  inventiaConfigurationMessage,
  inventiaStockWritesDisabledMessage,
  resolveInventiaConnection,
} from "../services/integration-settings";
import type { ApiBindings } from "./index";

const errorSchema = z.object({ error: z.string() }).strict();
const userIngredientFields = {
  name: ingredientSchema.shape.name,
  baseDimension: ingredientSchema.shape.baseDimension,
  baseUnit: ingredientSchema.shape.baseUnit,
  nutritionBasisAmount: ingredientSchema.shape.nutritionBasisAmount,
  nutritionPerBasis: nutritionFactsSchema,
  gramPerUnit: ingredientSchema.shape.gramPerUnit.optional(),
  memo: ingredientSchema.shape.memo.optional(),
};
const createIngredientRequestSchema = z
  .object(userIngredientFields)
  .strict()
  .superRefine((ingredient, context) => {
    if (
      ingredient.baseDimension === "mass" &&
      (ingredient.baseUnit !== "g" || ingredient.nutritionBasisAmount !== 100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseUnit"],
        message: "Mass ingredients must use g with a 100 g nutrition basis",
      });
    }
    if (
      ingredient.baseDimension === "volume" &&
      (ingredient.baseUnit !== "mL" || ingredient.nutritionBasisAmount !== 100)
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseUnit"],
        message: "Volume ingredients must use mL with a 100 mL nutrition basis",
      });
    }
    if (ingredient.baseDimension === "count" && ingredient.nutritionBasisAmount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["nutritionBasisAmount"],
        message: "Count ingredients must use a one-unit nutrition basis",
      });
    }
  });
const updateIngredientRequestSchema = z
  .object(userIngredientFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided.");
const inventiaSearchRequestSchema = z.object({ query: z.string().trim().min(1).max(200) }).strict();
const inventiaSyncRequestSchema = z
  .object({
    ingredientId: ingredientSchema.shape.id,
    itemId: z.string().trim().min(1).max(128),
  })
  .strict();
const inventiaItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUnit: z.string(),
  baseDimension: z.enum(["mass", "volume", "count"]),
  currentQuantity: z.number(),
});
const syncResultSchema = z.discriminatedUnion("synced", [
  z
    .object({
      synced: z.literal(true),
      ingredient: ingredientSchema,
      unitPriceYen: z.number(),
    })
    .strict(),
  z
    .object({
      synced: z.literal(false),
      reason: z.literal("no_price_records"),
      ingredient: ingredientSchema,
    })
    .strict(),
]);

export const ingredientRoutes = new OpenAPIHono<{ Bindings: ApiBindings }>();

const listIngredientsRoute = createRoute({
  method: "get",
  path: "/api/ingredients",
  summary: "List ingredients",
  responses: {
    200: {
      description: "Ingredient master list.",
      content: { "application/json": { schema: z.array(ingredientSchema) } },
    },
  },
});
ingredientRoutes.openapi(listIngredientsRoute, async (context) => {
  const { service } = createIngredientContext(context.env);
  return context.json(await service.list(), 200);
});

const createIngredientRoute = createRoute({
  method: "post",
  path: "/api/ingredients",
  summary: "Create an ingredient",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createIngredientRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Created ingredient.",
      content: { "application/json": { schema: ingredientSchema } },
    },
    400: {
      description: "Invalid ingredient input.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Unable to create ingredient.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(createIngredientRoute, async (context) => {
  const input = context.req.valid("json");
  const { service } = createIngredientContext(context.env);
  try {
    const ingredient = await service.create({
      ...input,
      id: crypto.randomUUID(),
      normalizedName: null,
      gramPerUnit: input.gramPerUnit ?? null,
      memo: input.memo ?? null,
      inventiaItemId: null,
      latestUnitPriceYen: null,
      latestPriceUpdatedAt: null,
    });
    return context.json(ingredient, 201);
  } catch (error) {
    if (error instanceof z.ZodError)
      return context.json({ error: "Invalid ingredient input." }, 400);
    return context.json({ error: "Unable to create ingredient." }, 500);
  }
});

const updateIngredientRoute = createRoute({
  method: "patch",
  path: "/api/ingredients/{id}",
  summary: "Update an ingredient",
  request: {
    params: z.object({ id: ingredientSchema.shape.id }).strict(),
    body: {
      required: true,
      content: { "application/json": { schema: updateIngredientRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated ingredient.",
      content: { "application/json": { schema: ingredientSchema } },
    },
    400: {
      description: "Invalid ingredient input.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Ingredient not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    500: {
      description: "Ingredient update failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(updateIngredientRoute, async (context) => {
  const { id } = context.req.valid("param");
  const changes = context.req.valid("json");
  const { service } = createIngredientContext(context.env);
  try {
    const ingredient = await service.update(id, changes);
    if (!ingredient) return context.json({ error: "Ingredient not found." }, 404);
    return context.json(ingredient, 200);
  } catch (error) {
    if (error instanceof z.ZodError)
      return context.json({ error: "Invalid ingredient input." }, 400);
    return context.json({ error: "Unable to update ingredient." }, 500);
  }
});

const deleteIngredientRoute = createRoute({
  method: "delete",
  path: "/api/ingredients/{id}",
  summary: "Delete an ingredient",
  request: { params: z.object({ id: ingredientSchema.shape.id }).strict() },
  responses: {
    204: { description: "Ingredient deleted." },
    404: {
      description: "Ingredient not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(deleteIngredientRoute, async (context) => {
  const { id } = context.req.valid("param");
  const { service } = createIngredientContext(context.env);
  const deleted = await service.delete(id);
  if (!deleted) return context.json({ error: "Ingredient not found." }, 404);
  return context.body(null, 204);
});

const searchInventiaRoute = createRoute({
  method: "post",
  path: "/api/ingredients/search-inventia",
  summary: "Search Inventia items",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: inventiaSearchRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Matching Inventia items.",
      content: { "application/json": { schema: z.array(inventiaItemSchema) } },
    },
    400: {
      description: "The query matches too many Inventia items.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "A linked Inventia item was not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia is not configured.",
      content: { "application/json": { schema: errorSchema } },
    },
    502: {
      description: "Inventia search failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(searchInventiaRoute, async (context) => {
  const { query } = context.req.valid("json");
  const { service, inventiaStatus } = await createInventiaContext(context.env);
  if (!inventiaStatus.capabilities.readItems)
    return context.json({ error: inventiaConfigurationMessage(inventiaStatus.issue) }, 409);
  try {
    const items = await service.searchInventiaItems(query);
    return context.json(items, 200);
  } catch (error) {
    const failure = describeInventiaFailure(error, "Inventia search failed.");
    return context.json({ error: failure.error }, failure.status);
  }
});

const syncInventiaRoute = createRoute({
  method: "post",
  path: "/api/ingredients/sync-inventia",
  summary: "Sync ingredient price from Inventia",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: inventiaSyncRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Price synchronization result.",
      content: { "application/json": { schema: syncResultSchema } },
    },
    400: {
      description: "Inventia rejected the price request.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Ingredient or Inventia item not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia is not configured.",
      content: { "application/json": { schema: errorSchema } },
    },
    502: {
      description: "Inventia price synchronization failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(syncInventiaRoute, async (context) => {
  const { ingredientId, itemId } = context.req.valid("json");
  const { service, repository, inventiaStatus } = await createInventiaContext(context.env);
  if (!(await repository.getById(ingredientId))) {
    return context.json({ error: "Ingredient not found." }, 404);
  }
  if (!inventiaStatus.capabilities.readItems)
    return context.json({ error: inventiaConfigurationMessage(inventiaStatus.issue) }, 409);
  try {
    return context.json(await service.syncInventiaPrice(ingredientId, itemId), 200);
  } catch (error) {
    const failure = describeInventiaFailure(error, "Inventia price synchronization failed.");
    return context.json({ error: failure.error }, failure.status);
  }
});

const stockResultSchema = z
  .object({
    found: z.boolean(),
    currentQuantity: z.number().nullable(),
    baseUnit: z.string().nullable(),
  })
  .strict();
const adjustStockRequestSchema = z
  .object({ amount: z.number(), idempotencyKey: z.string() })
  .strict();
const idempotencyKeyPattern = /^[A-Za-z0-9_.:-]{1,200}$/;

const ingredientStockRoute = createRoute({
  method: "get",
  path: "/api/ingredients/{id}/stock",
  summary: "Read Inventia stock for a linked ingredient",
  request: { params: z.object({ id: ingredientSchema.shape.id }).strict() },
  responses: {
    200: {
      description: "Current Inventia quantity for the linked item.",
      content: { "application/json": { schema: stockResultSchema } },
    },
    400: {
      description: "Inventia rejected the stock request.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Ingredient not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia is not configured.",
      content: { "application/json": { schema: errorSchema } },
    },
    502: {
      description: "Inventia stock lookup failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(ingredientStockRoute, async (context) => {
  const { id } = context.req.valid("param");
  const { service, inventiaStatus } = await createInventiaContext(context.env);
  if (!(await service.get(id))) return context.json({ error: "Ingredient not found." }, 404);
  if (!inventiaStatus.capabilities.readItems)
    return context.json({ error: inventiaConfigurationMessage(inventiaStatus.issue) }, 409);
  try {
    return context.json(await service.inventiaStock(id), 200);
  } catch (error) {
    const failure = describeInventiaFailure(error, "Inventia stock lookup failed.");
    return context.json({ error: failure.error }, failure.status);
  }
});

const ingredientAdjustStockRoute = createRoute({
  method: "post",
  path: "/api/ingredients/{id}/stock",
  summary: "Consume Inventia stock for an ingredient",
  request: {
    params: z.object({ id: ingredientSchema.shape.id }).strict(),
    body: {
      required: true,
      content: { "application/json": { schema: adjustStockRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Stock adjustment result.",
      content: { "application/json": { schema: z.unknown() } },
    },
    400: {
      description: "Invalid adjustment input.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Ingredient not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Inventia is not configured.",
      content: { "application/json": { schema: errorSchema } },
    },
    502: {
      description: "Inventia stock adjustment failed.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
ingredientRoutes.openapi(ingredientAdjustStockRoute, async (context) => {
  if (context.env.INVENTIA_STOCK_WRITES_ENABLED !== "true")
    return context.json({ error: inventiaStockWritesDisabledMessage }, 409);
  const { id } = context.req.valid("param");
  const { amount, idempotencyKey } = context.req.valid("json");
  if (!idempotencyKeyPattern.test(idempotencyKey))
    return context.json(
      {
        error: "idempotencyKey must be 1-200 characters of letters, digits, '.', '_', ':', or '-'.",
      },
      400,
    );
  const { service, inventiaStatus } = await createInventiaContext(context.env);
  if (!(await service.get(id))) return context.json({ error: "Ingredient not found." }, 404);
  if (!inventiaStatus.capabilities.readItems)
    return context.json({ error: inventiaConfigurationMessage(inventiaStatus.issue) }, 409);
  if (!inventiaStatus.capabilities.writeStock)
    return context.json({ error: "Inventia provider ID is required for stock writes." }, 409);
  try {
    return context.json(await service.adjustInventiaStock(id, amount, idempotencyKey), 200);
  } catch (error) {
    const failure = describeInventiaFailure(error, "Inventia stock adjustment failed.");
    return context.json({ error: failure.error }, failure.status);
  }
});

function createIngredientContext(env: ApiBindings) {
  const repository = createIngredientRepository(createDbClient(env.DB));
  return {
    repository,
    service: createIngredientService({ repository }),
  };
}

async function createInventiaContext(env: ApiBindings) {
  const { repository } = createIngredientContext(env);
  const settings = await createSettingsRepository(createDbClient(env.DB)).get("inventia");
  const { client, status } = await resolveInventiaConnection(settings, env);
  return {
    repository,
    service: createIngredientService({
      repository,
      ...(client ? { inventiaClient: client, providerId: status.providerId ?? undefined } : {}),
    }),
    inventiaStatus: status,
  };
}
