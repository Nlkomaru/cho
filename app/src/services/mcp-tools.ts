import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  dishSchema,
  ingredientObjectSchema,
  ingredientSchema,
  mealLogItemBaseSchema,
  mealLogSchema,
} from "../domain/ingredient";
import {
  calculatePurchaseListInputSchema,
  deleteIngredientInputSchema,
  deleteRecipeInputSchema,
  deleteResultSchema,
  purchaseListResultSchema,
  type McpToolName,
} from "../domain/mcp";
import { calculatePurchaseList } from "../domain/purchase-list";
import { recipeSchema } from "../domain/recipe";
import { createDbClient } from "../db/client";
import { createDishRepository } from "../repositories/dish-repository";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createMealLogRepository } from "../repositories/meal-log-repository";
import { createDishService } from "./dish";
import { createIngredientService } from "./ingredient";
import { createMealLogService } from "./meal-log";

const listInput = z.object({}).strict();
const ingredientInput = ingredientObjectSchema
  .omit({
    id: true,
    normalizedName: true,
    inventiaItemId: true,
    latestUnitPriceYen: true,
    latestPriceUpdatedAt: true,
  })
  .strict();
const recipeInput = z
  .object({
    name: dishSchema.shape.name,
    category: dishSchema.shape.category,
    servings: dishSchema.shape.servings,
    recipe: recipeSchema,
    coverImageId: dishSchema.shape.coverImageId,
    notes: dishSchema.shape.notes,
  })
  .strict();
const mealItemInput = mealLogItemBaseSchema
  .omit({ id: true })
  .extend({ id: z.string().trim().min(1).max(128).optional() })
  .strict();
const mealInput = mealLogSchema
  .omit({ id: true, inventiaConsumptionStatus: true, items: true })
  .extend({ items: z.array(mealItemInput).min(1) })
  .strict();

const output = {
  ingredients: z.object({ items: z.array(ingredientSchema) }).strict(),
  ingredient: z.object({ ingredient: ingredientSchema }).strict(),
  recipes: z.object({ recipes: z.array(dishSchema) }).strict(),
  recipe: z.object({ recipe: dishSchema }).strict(),
  meal: z.object({ meal: mealLogSchema }).strict(),
  deleteResult: deleteResultSchema,
  purchaseList: purchaseListResultSchema,
};

function mcpSuccess<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createMcpServer(
  dbBinding: D1Database,
  allowedTools: readonly McpToolName[],
): McpServer {
  const db = createDbClient(dbBinding);
  const ingredientRepository = createIngredientRepository(db);
  const dishRepository = createDishRepository(db);
  const mealRepository = createMealLogRepository(db);
  const ingredientService = createIngredientService({ repository: ingredientRepository });
  const dishService = createDishService({ repository: dishRepository, ingredientRepository });
  const mealService = createMealLogService({
    repository: mealRepository,
    dishRepository,
    ingredientRepository,
  });
  const allowed = new Set(allowedTools);
  const server = new McpServer({ name: "cho", version: "1.0.0" });

  if (allowed.has("list_ingredients"))
    server.registerTool(
      "list_ingredients",
      {
        title: "List ingredients",
        description: "List ingredients registered in Cho.",
        inputSchema: listInput,
        outputSchema: output.ingredients,
      },
      async () => mcpSuccess({ items: await ingredientService.list() }),
    );
  if (allowed.has("create_ingredient"))
    server.registerTool(
      "create_ingredient",
      {
        title: "Register an ingredient",
        description: "Register a new ingredient in Cho.",
        inputSchema: ingredientInput,
        outputSchema: output.ingredient,
      },
      async (input) => {
        const ingredient = ingredientSchema.parse({ ...input, id: crypto.randomUUID() });
        return mcpSuccess({ ingredient: await ingredientService.create(ingredient) });
      },
    );
  if (allowed.has("delete_ingredient"))
    server.registerTool(
      "delete_ingredient",
      {
        title: "Delete an ingredient",
        description: "Delete an ingredient registered in Cho.",
        inputSchema: deleteIngredientInputSchema,
        outputSchema: output.deleteResult,
      },
      async (input) => {
        const targetId = input.id ?? input.ingredientId;
        if (!targetId) {
          throw new Error("Missing ingredient ID");
        }
        const deleted = await ingredientService.delete(targetId);
        return mcpSuccess({ success: Boolean(deleted), deletedId: targetId });
      },
    );
  if (allowed.has("list_recipes"))
    server.registerTool(
      "list_recipes",
      {
        title: "List recipes",
        description: "List recipes registered in Cho.",
        inputSchema: listInput,
        outputSchema: output.recipes,
      },
      async () => mcpSuccess({ recipes: await dishService.list() }),
    );
  if (allowed.has("create_recipe"))
    server.registerTool(
      "create_recipe",
      {
        title: "Register a recipe",
        description: "Register a recipe in Cho.",
        inputSchema: recipeInput,
        outputSchema: output.recipe,
      },
      async (input) => {
        const dish = dishSchema.parse({ ...input, id: crypto.randomUUID() });
        return mcpSuccess({ recipe: await dishService.create(dish) });
      },
    );
  if (allowed.has("delete_recipe"))
    server.registerTool(
      "delete_recipe",
      {
        title: "Delete a recipe",
        description: "Delete a recipe registered in Cho.",
        inputSchema: deleteRecipeInputSchema,
        outputSchema: output.deleteResult,
      },
      async (input) => {
        const targetId = input.id ?? input.recipeId;
        if (!targetId) {
          throw new Error("Missing recipe ID");
        }
        const deleted = await dishService.delete(targetId);
        return mcpSuccess({ success: Boolean(deleted), deletedId: targetId });
      },
    );
  if (allowed.has("calculate_purchase_list"))
    server.registerTool(
      "calculate_purchase_list",
      {
        title: "Calculate purchase and shortage list",
        description:
          "Calculate inventory shortages, purchase amounts, unit costs, and output a unified Markdown table for a recipe.",
        inputSchema: calculatePurchaseListInputSchema,
        outputSchema: output.purchaseList,
      },
      async (input) => {
        let recipe = input.recipe;
        if (!recipe && (input.dishId || input.recipeId)) {
          const targetId = input.dishId ?? input.recipeId;
          if (!targetId) {
            throw new Error("Missing dish ID");
          }
          const dish = await dishService.get(targetId);
          if (!dish) throw new Error(`Dish not found: ${targetId}`);
          recipe = dish.recipe;
        }
        if (!recipe) {
          throw new Error("Either recipe or dishId/recipeId must be provided");
        }

        const ingredients = await ingredientService.list();
        const inventory: Record<string, { currentQuantity: number; baseUnit: string }> = {};

        for (const entry of recipe.ingredients) {
          if (entry.ingredientId) {
            try {
              const stock = await ingredientService.inventiaStock(entry.ingredientId);
              if (stock.found && stock.currentQuantity !== null) {
                inventory[entry.ingredientId] = {
                  currentQuantity: stock.currentQuantity,
                  baseUnit: stock.baseUnit ?? entry.unit,
                };
              }
            } catch {
              // Inventia not configured; ignore
            }
          }
        }

        const rawInventory = {
          ...input.inventory,
          ...input.inventoryOverrides,
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
          recipe,
          ingredients,
          inventory,
        });

        return mcpSuccess(result);
      },
    );
  if (allowed.has("record_meal"))
    server.registerTool(
      "record_meal",
      {
        title: "Record a meal",
        description: "Record a meal in Cho without changing Inventia stock.",
        inputSchema: mealInput,
        outputSchema: output.meal,
      },
      async (input) => mcpSuccess({ meal: await mealService.create(input) }),
    );
  return server;
}
