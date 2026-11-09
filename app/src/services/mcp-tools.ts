import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ApiBindings } from "../api/index";
import {
  dishSchema,
  ingredientObjectSchema,
  ingredientSchema,
  inventiaItemIdSchema,
  mealLogItemBaseSchema,
  mealLogSchema,
  type Ingredient,
} from "../domain/ingredient";
import {
  aliasesAgree,
  calculatePurchaseListInputSchema,
  createImageUploadInputSchema,
  deleteIngredientInputSchema,
  deleteRecipeInputSchema,
  deleteResultSchema,
  getIngredientInputSchema,
  getIngredientStockInputSchema,
  getRecipeInputSchema,
  idInputSchema,
  linkInventiaItemInputSchema,
  listMealsInputSchema,
  purchaseListResultSchema,
  searchInventiaItemsInputSchema,
  setRecipeImagesInputSchema,
  updateIngredientInputSchema,
  uploadImageInputSchema,
  type McpToolName,
} from "../domain/mcp";
import { calculatePurchaseList } from "../domain/purchase-list";
import { recipeSchema } from "../domain/recipe";
import { createDbClient } from "../db/client";
import { MAX_IMAGE_BYTES, MAX_INLINE_IMAGE_BYTES } from "../domain/image";
import { createDishRepository } from "../repositories/dish-repository";
import { createIngredientRepository } from "../repositories/ingredient-repository";
import { createMealLogRepository } from "../repositories/meal-log-repository";
import { createSettingsRepository } from "../repositories/settings-repository";
import { createDishService } from "./dish";
import { createSignedUploadUrl } from "./image-storage";
import { createIngredientService, type IngredientInventiaClient } from "./ingredient";
import { inventiaConfigurationMessage, resolveInventiaConnection } from "./integration-settings";
import {
  describeInventiaFailure,
  InventiaAmountError,
  InventiaHttpError,
  InventiaItemNotFoundError,
  InventiaSearchLimitError,
  InventiaUnitMismatchError,
} from "./inventia-client";
import { createMealLogService } from "./meal-log";
import { ImageUploadError, readLimited, schedulePurge, storeImage } from "./media-images";

/** Raised when a tool needs Inventia but the connection is missing or unusable. */
class InventiaUnavailableError extends Error {}

const idSchema = z.string().trim().min(1).max(128);
const idempotencyId = idSchema
  .optional()
  .describe(
    "Optional client-chosen ID. If a record with this ID already exists it is returned unchanged with created:false, so a retry after a timeout does not create a duplicate",
  );
const listInput = z.object({}).strict();
const ingredientInput = ingredientObjectSchema
  .omit({
    id: true,
    normalizedName: true,
    latestUnitPriceYen: true,
    latestPriceUpdatedAt: true,
  })
  .extend({
    id: idempotencyId,
    inventiaItemId: inventiaItemIdSchema
      .nullable()
      .optional()
      .describe(
        "Inventia item ID to link. Checked against Inventia (existence and unit) and the latest price is pulled; fails when Inventia is not configured. Use search_inventia_items to find IDs",
      ),
    inventia_item_id: inventiaItemIdSchema
      .nullable()
      .optional()
      .describe("Alias of inventiaItemId"),
  })
  .strict()
  .refine((data) => aliasesAgree(data.inventiaItemId, data.inventia_item_id), {
    message: "inventiaItemId and inventia_item_id must match when both are given",
  });
// Recipe servings may be omitted here so the dish-level servings can supply it.
const toolRecipeSchema = recipeSchema.extend({
  servings: recipeSchema.shape.servings.removeDefault().optional(),
});
const recipeInput = z
  .object({
    id: idempotencyId,
    name: dishSchema.shape.name,
    category: dishSchema.shape.category,
    servings: dishSchema.shape.servings
      .optional()
      .describe(
        "Servings. Defaults to recipe.servings. If both are given and differ, this value wins and recipe.servings is set to match",
      ),
    recipe: toolRecipeSchema,
    coverImageId: dishSchema.shape.coverImageId.describe(
      "Cover image ID from upload_image or create_image_upload, or null",
    ),
    notes: dishSchema.shape.notes,
  })
  .strict();
const updateRecipeInput = z
  .object({
    id: idSchema.describe("Recipe ID"),
    name: dishSchema.shape.name.optional(),
    category: dishSchema.shape.category.removeDefault().optional(),
    servings: dishSchema.shape.servings
      .optional()
      .describe(
        "Servings. If recipe.servings differs, this value wins and recipe.servings is set to match",
      ),
    recipe: toolRecipeSchema
      .optional()
      .describe(
        "Replaces the whole recipe, including steps[].imageIds. To change one step, send the full recipe with that step edited. To change only images, use set_recipe_images",
      ),
    coverImageId: dishSchema.shape.coverImageId
      .removeDefault()
      .optional()
      .describe("Cover image ID, or null to remove the cover. Omit to keep it"),
    notes: dishSchema.shape.notes.removeDefault().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).some((key) => key !== "id"), {
    message: "At least one field to change must be provided",
  });
const mealItemInput = mealLogItemBaseSchema
  .omit({ id: true })
  .extend({ id: z.string().trim().min(1).max(128).optional() })
  .strict();
const mealInput = mealLogSchema
  .omit({ id: true, inventiaConsumptionStatus: true, items: true })
  .extend({ id: idempotencyId, items: z.array(mealItemInput).min(1).max(100) })
  .strict();
const updateMealInput = z
  .object({
    id: idSchema.describe("Meal ID"),
    eatenAt: mealLogSchema.shape.eatenAt.optional(),
    mealTiming: mealLogSchema.shape.mealTiming.removeDefault().optional(),
    sourceType: mealLogSchema.shape.sourceType.optional(),
    placeName: mealLogSchema.shape.placeName.removeDefault().optional(),
    title: mealLogSchema.shape.title.optional(),
    totalPriceYen: mealLogSchema.shape.totalPriceYen.removeDefault().optional(),
    totalNutrition: mealLogSchema.shape.totalNutrition.removeDefault().optional(),
    rating: mealLogSchema.shape.rating.removeDefault().optional(),
    memo: mealLogSchema.shape.memo.removeDefault().optional(),
    items: z.array(mealItemInput).min(1).max(100).optional().describe("Replaces all items"),
  })
  .strict()
  .refine((data) => Object.keys(data).some((key) => key !== "id"), {
    message: "At least one field to change must be provided",
  });

const inventiaItemOutput = z
  .object({
    id: z.string(),
    name: z.string(),
    baseUnit: z.string(),
    baseDimension: z.enum(["mass", "volume", "count"]),
    currentQuantity: z.number(),
  })
  .strict();
const output = {
  ingredients: z.object({ items: z.array(ingredientSchema) }).strict(),
  ingredient: z.object({ ingredient: ingredientSchema }).strict(),
  ingredientCreated: z.object({ ingredient: ingredientSchema, created: z.boolean() }).strict(),
  recipes: z.object({ recipes: z.array(dishSchema) }).strict(),
  recipe: z.object({ recipe: dishSchema }).strict(),
  recipeCreated: z.object({ recipe: dishSchema, created: z.boolean() }).strict(),
  meal: z.object({ meal: mealLogSchema }).strict(),
  mealCreated: z.object({ meal: mealLogSchema, created: z.boolean() }).strict(),
  meals: z
    .object({ meals: z.array(mealLogSchema), total: z.number(), hasMore: z.boolean() })
    .strict(),
  deleteResult: deleteResultSchema,
  purchaseList: purchaseListResultSchema,
  inventiaItems: z
    .object({
      items: z.array(inventiaItemOutput),
      total: z.number(),
      truncated: z.boolean(),
    })
    .strict(),
  link: z
    .object({
      ingredient: ingredientSchema,
      synced: z.boolean(),
      unitPriceYen: z.number().nullable(),
    })
    .strict(),
  image: z.object({ imageId: z.string(), contentType: z.string(), byteSize: z.number() }).strict(),
  imageUpload: z
    .object({
      imageId: z.string(),
      uploadUrl: z.string(),
      method: z.literal("PUT"),
      contentType: z.string(),
      maxBytes: z.number(),
      expiresAt: z.string(),
    })
    .strict(),
  stock: z
    .object({
      found: z.boolean(),
      currentQuantity: z.number().nullable(),
      baseUnit: z.string().nullable(),
    })
    .strict(),
};

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const create = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const;
const update = { readOnlyHint: false, destructiveHint: false, idempotentHint: true } as const;
const destroy = { readOnlyHint: false, destructiveHint: true, idempotentHint: true } as const;

const maxSearchResults = 50;
const uploadUrlLifetimeSeconds = 10 * 60;
const imageFetchTimeoutMs = 10_000;
const stockLookupBatch = 10;

function mcpSuccess<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function toToolError(error: unknown): unknown {
  if (error instanceof z.ZodError)
    return new Error(
      `Invalid input: ${error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "") + issue.message)
        .join("; ")}`,
    );
  if (
    error instanceof InventiaHttpError ||
    error instanceof InventiaAmountError ||
    error instanceof InventiaItemNotFoundError ||
    error instanceof InventiaSearchLimitError ||
    error instanceof InventiaUnitMismatchError
  )
    return new Error(describeInventiaFailure(error, "Inventia request failed.").error);
  return error;
}

/** Turns validation and Inventia failures into short messages for the MCP client. */
function guard<A extends unknown[], R>(handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      throw toToolError(error);
    }
  };
}

/** The dish-level value drives nutrition and cost totals, so it wins when both are sent. */
function resolveServings(
  dishServings: number | undefined,
  recipeServings: number | undefined,
  fallback: number,
): number {
  return dishServings ?? recipeServings ?? fallback;
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const maxImageRedirects = 3;

/** Allows only public https hosts: no IP literals, single-label or local names. */
function assertPublicHttpsUrl(url: URL): void {
  // "localhost." and "example.internal." name the same hosts as their dotless forms.
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  const isIpLiteral = host.startsWith("[") || /^\d+(\.\d+){0,3}$/.test(host);
  const isLocalName =
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost");
  if (url.protocol !== "https:" || isIpLiteral || isLocalName)
    throw new Error("The image URL must be a public https URL.");
}

async function fetchImage(url: string): Promise<Uint8Array> {
  let target = new URL(url);
  let response: Response | undefined;
  for (let hop = 0; hop <= maxImageRedirects; hop++) {
    assertPublicHttpsUrl(target);
    try {
      response = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(imageFetchTimeoutMs),
        headers: { Accept: "image/*" },
      });
    } catch {
      throw new Error(`Could not fetch the image from ${target.origin}`);
    }
    const location =
      response.status >= 300 && response.status < 400 ? response.headers.get("Location") : null;
    if (!location) break;
    await response.body?.cancel().catch(() => undefined);
    if (hop === maxImageRedirects) throw new Error("The image URL redirected too many times.");
    try {
      target = new URL(location, target);
    } catch {
      throw new Error("The image URL redirected to an invalid location.");
    }
  }
  if (!response) throw new Error("Could not fetch the image.");
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Fetching the image failed with HTTP ${response.status}`);
  }
  if (Number(response.headers.get("Content-Length") ?? 0) > MAX_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new ImageUploadError("Image exceeds the 10 MiB upload limit.", 413);
  }
  return readLimited(response.body, MAX_IMAGE_BYTES);
}

export interface McpServerOptions {
  /** Public origin used to build upload URLs. create_image_upload fails without it. */
  origin?: string;
  /** Lets background work such as the stale image purge outlive the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function createMcpServer(
  env: ApiBindings,
  allowedTools: readonly McpToolName[],
  options: McpServerOptions = {},
): McpServer {
  const db = createDbClient(env.DB);
  const ingredientRepository = createIngredientRepository(db);
  const dishRepository = createDishRepository(db);
  const mealRepository = createMealLogRepository(db);

  // The connection is resolved on first use so tools that never touch Inventia
  // do not pay for settings lookup and token decryption.
  let connection: ReturnType<typeof resolveInventiaConnection> | null = null;
  const inventiaConnection = () =>
    (connection ??= createSettingsRepository(db)
      .get("inventia")
      .then((settings) => resolveInventiaConnection(settings, env)));
  async function readyClient() {
    const { client, status } = await inventiaConnection();
    if (!client || !status.capabilities.readItems)
      throw new InventiaUnavailableError(inventiaConfigurationMessage(status.issue));
    return client;
  }
  const inventiaClient: IngredientInventiaClient = {
    searchItems: async (query) => (await readyClient()).searchItems(query),
    getItem: async (id) => (await readyClient()).getItem(id),
    getItemPrices: async (id) => (await readyClient()).getItemPrices(id),
    adjustStock: async (id, input) => (await readyClient()).adjustStock(id, input),
  };

  const ingredientService = createIngredientService({
    repository: ingredientRepository,
    inventiaClient,
  });
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
        description:
          "List ingredients registered in Cho. Use the returned id as recipe.ingredients[].ingredientId when registering a recipe.",
        inputSchema: listInput,
        outputSchema: output.ingredients,
        annotations: readOnly,
      },
      guard(async () => mcpSuccess({ items: await ingredientService.list() })),
    );
  if (allowed.has("get_ingredient"))
    server.registerTool(
      "get_ingredient",
      {
        title: "Get an ingredient",
        description: "Get one ingredient registered in Cho by ID.",
        inputSchema: getIngredientInputSchema,
        outputSchema: output.ingredient,
        annotations: readOnly,
      },
      guard(async (input) => {
        const targetId = input.id ?? input.ingredientId ?? "";
        const ingredient = await ingredientService.get(targetId);
        if (!ingredient) throw new Error(`Ingredient not found: ${targetId}`);
        return mcpSuccess({ ingredient });
      }),
    );
  if (allowed.has("create_ingredient"))
    server.registerTool(
      "create_ingredient",
      {
        title: "Register an ingredient",
        description:
          "Register a new ingredient in Cho. Mass ingredients use baseUnit g with nutritionBasisAmount 100, volume ingredients use mL with 100, count ingredients use a basis of 1. If inventiaItemId is given it is verified against Inventia and nothing is stored when the check fails. Pass id to make a retry safe.",
        inputSchema: ingredientInput,
        outputSchema: output.ingredientCreated,
        annotations: create,
      },
      guard(async (input) => {
        const { id, inventiaItemId, inventia_item_id, ...rest } = input;
        if (id) {
          const existing = await ingredientService.get(id);
          if (existing) return mcpSuccess({ ingredient: existing, created: false });
        }
        const ingredient = ingredientSchema.parse({
          ...rest,
          inventiaItemId: inventiaItemId ?? inventia_item_id ?? null,
          id: id ?? crypto.randomUUID(),
        });
        return mcpSuccess({
          ingredient: await ingredientService.create(ingredient),
          created: true,
        });
      }),
    );
  if (allowed.has("update_ingredient"))
    server.registerTool(
      "update_ingredient",
      {
        title: "Update an ingredient",
        description:
          "Update fields of an existing ingredient. Changing baseDimension or baseUnit clears the Inventia link and price unless inventiaItemId is sent in the same call. A non-null inventiaItemId is verified against Inventia (existence and unit) and the latest price is pulled; null unlinks.",
        inputSchema: updateIngredientInputSchema,
        outputSchema: output.ingredient,
        annotations: update,
      },
      guard(async (input) => {
        const { id, ingredientId, inventia_item_id, ...fields } = input;
        const targetId = id ?? ingredientId ?? "";
        const changes = Object.fromEntries(
          Object.entries({
            ...fields,
            inventiaItemId: fields.inventiaItemId ?? inventia_item_id,
          }).filter(([, value]) => value !== undefined),
        ) as Partial<Omit<Ingredient, "id">>;
        // `null` is a real value for inventiaItemId (unlink); `??` above would
        // swallow it, so restore it when the caller sent null explicitly.
        if (fields.inventiaItemId === null || inventia_item_id === null)
          changes.inventiaItemId = null;
        const updated = await ingredientService.update(targetId, changes);
        if (!updated) throw new Error(`Ingredient not found: ${targetId}`);
        return mcpSuccess({ ingredient: updated });
      }),
    );
  if (allowed.has("delete_ingredient"))
    server.registerTool(
      "delete_ingredient",
      {
        title: "Delete an ingredient",
        description: "Delete an ingredient registered in Cho.",
        inputSchema: deleteIngredientInputSchema,
        outputSchema: output.deleteResult,
        annotations: destroy,
      },
      guard(async (input) => {
        const targetId = input.id ?? input.ingredientId ?? "";
        const deleted = await ingredientService.delete(targetId);
        return mcpSuccess({ success: Boolean(deleted), deletedId: targetId });
      }),
    );
  if (allowed.has("search_inventia_items"))
    server.registerTool(
      "search_inventia_items",
      {
        title: "Search Inventia items",
        description:
          "Search Inventia items by name to find the item ID for link_inventia_item or inventiaItemId. Returns at most 50 items; narrow the query when truncated is true.",
        inputSchema: searchInventiaItemsInputSchema,
        outputSchema: output.inventiaItems,
        annotations: { ...readOnly, openWorldHint: true },
      },
      guard(async (input) => {
        const items = await ingredientService.searchInventiaItems(input.query);
        return mcpSuccess({
          items: items.slice(0, maxSearchResults).map((item) => ({
            id: item.id,
            name: item.name,
            baseUnit: item.baseUnit,
            baseDimension: item.baseDimension,
            currentQuantity: item.currentQuantity,
          })),
          total: items.length,
          truncated: items.length > maxSearchResults,
        });
      }),
    );
  if (allowed.has("link_inventia_item"))
    server.registerTool(
      "link_inventia_item",
      {
        title: "Link an ingredient to an Inventia item",
        description:
          "Link a Cho ingredient to an Inventia item. Checks that the item exists and that its unit matches the ingredient, then stores the latest Inventia unit price. synced is false when Inventia has no price record; the link is still saved.",
        inputSchema: linkInventiaItemInputSchema,
        outputSchema: output.link,
        annotations: { ...update, openWorldHint: true },
      },
      guard(async (input) => {
        const result = await ingredientService.linkInventiaItem(input.ingredientId, input.itemId);
        return mcpSuccess({
          ingredient: result.ingredient,
          synced: result.synced,
          unitPriceYen: result.synced ? result.unitPriceYen : null,
        });
      }),
    );
  if (allowed.has("get_ingredient_stock"))
    server.registerTool(
      "get_ingredient_stock",
      {
        title: "Get Inventia stock of an ingredient",
        description:
          "Read the current Inventia stock of an ingredient. found is false when the ingredient is not linked or the item no longer exists.",
        inputSchema: getIngredientStockInputSchema,
        outputSchema: output.stock,
        annotations: { ...readOnly, openWorldHint: true },
      },
      guard(async (input) => mcpSuccess(await ingredientService.inventiaStock(input.ingredientId))),
    );
  if (allowed.has("list_recipes"))
    server.registerTool(
      "list_recipes",
      {
        title: "List recipes",
        description: "List recipes registered in Cho. Use get_recipe to read a single recipe.",
        inputSchema: listInput,
        outputSchema: output.recipes,
        annotations: readOnly,
      },
      guard(async () => mcpSuccess({ recipes: await dishService.list() })),
    );
  if (allowed.has("get_recipe"))
    server.registerTool(
      "get_recipe",
      {
        title: "Get a recipe",
        description: "Get one recipe registered in Cho by ID.",
        inputSchema: getRecipeInputSchema,
        outputSchema: output.recipe,
        annotations: readOnly,
      },
      guard(async (input) => {
        const targetId = input.id ?? input.recipeId ?? "";
        const recipe = await dishService.get(targetId);
        if (!recipe) throw new Error(`Recipe not found: ${targetId}`);
        return mcpSuccess({ recipe });
      }),
    );
  if (allowed.has("create_recipe"))
    server.registerTool(
      "create_recipe",
      {
        title: "Register a recipe",
        description: [
          "Register a recipe in Cho. Workflow:",
          "1) Call list_ingredients, or create_ingredient for missing ones, and note each ingredient UUID.",
          "2) Build recipe.ingredients. Each entry has a recipe-local id (lowercase letters, digits, - and _, up to 64 characters) and an ingredientId that must be an existing Cho ingredient UUID. amount is in the ingredient base unit.",
          "3) Build recipe.steps. Each step has a local id; list the steps that must finish first in dependsOnStepIds. The graph must have no cycle.",
          "4) Step inputs refer to local ids: ingredientEntryId (recipe.ingredients[].id), groupId (recipe.ingredientGroups[].id), or fromStepId plus outputId (an earlier step's outputs[].id).",
          "5) Optional images: upload with upload_image or create_image_upload, then put the returned imageId in coverImageId or recipe.steps[].imageIds (up to 4 per step). Each image can be used once.",
          "All durations are in seconds. servings and recipe.servings describe the same value; if both are sent and differ, servings wins. Pass id to make a retry safe.",
        ].join(" "),
        inputSchema: recipeInput,
        outputSchema: output.recipeCreated,
        annotations: create,
      },
      guard(async (input) => {
        const { id, servings, ...fields } = input;
        if (id) {
          const existing = await dishRepository.getById(id);
          if (existing) return mcpSuccess({ recipe: existing, created: false });
        }
        const resolved = resolveServings(servings, input.recipe.servings, 1);
        const dish = dishSchema.parse({
          ...fields,
          id: id ?? crypto.randomUUID(),
          servings: resolved,
          recipe: { ...input.recipe, servings: resolved },
        });
        return mcpSuccess({ recipe: await dishService.create(dish), created: true });
      }),
    );
  if (allowed.has("update_recipe"))
    server.registerTool(
      "update_recipe",
      {
        title: "Update a recipe",
        description:
          "Update a recipe in place, keeping its ID so past meals stay linked. Sending recipe replaces the whole recipe (same rules as create_recipe: existing ingredient UUIDs, local IDs, acyclic dependsOnStepIds). Omitted fields are unchanged.",
        inputSchema: updateRecipeInput,
        outputSchema: output.recipe,
        annotations: update,
      },
      guard(async (input) => {
        const current = await dishService.get(input.id);
        if (!current) throw new Error(`Recipe not found: ${input.id}`);
        const servings = resolveServings(input.servings, input.recipe?.servings, current.servings);
        const recipe = recipeSchema.parse({
          ...(input.recipe ?? current.recipe),
          servings,
        });
        const changes = { servings, recipe } as Parameters<typeof dishService.update>[1];
        if (input.name !== undefined) changes.name = input.name;
        if (input.category !== undefined) changes.category = input.category;
        if (input.notes !== undefined) changes.notes = input.notes;
        if (input.coverImageId !== undefined) changes.coverImageId = input.coverImageId;
        const updated = await dishService.update(input.id, changes);
        if (!updated) throw new Error(`Recipe not found: ${input.id}`);
        return mcpSuccess({ recipe: updated });
      }),
    );
  if (allowed.has("delete_recipe"))
    server.registerTool(
      "delete_recipe",
      {
        title: "Delete a recipe",
        description:
          "Delete a recipe registered in Cho. Past meals keep their records but lose the link to the recipe. To fix a recipe, use update_recipe instead.",
        inputSchema: deleteRecipeInputSchema,
        outputSchema: output.deleteResult,
        annotations: destroy,
      },
      guard(async (input) => {
        const targetId = input.id ?? input.recipeId ?? "";
        const deleted = await dishService.delete(targetId);
        return mcpSuccess({ success: Boolean(deleted), deletedId: targetId });
      }),
    );
  if (allowed.has("upload_image"))
    server.registerTool(
      "upload_image",
      {
        title: "Upload an image",
        description:
          "Store an image for a recipe cover or step and return its imageId. Pass url (public https, up to 10 MiB, fetched by the server) or data (base64, up to 2 MiB). JPEG, PNG, WebP, GIF and AVIF are accepted; the type is detected from the content. If you can run shell commands, create_image_upload is better for local files. An image not used by any recipe or meal within 24 hours is deleted.",
        inputSchema: uploadImageInputSchema,
        outputSchema: output.image,
        annotations: { ...create, openWorldHint: true },
      },
      guard(async (input) => {
        const bytes = input.url ? await fetchImage(input.url) : decodeBase64(input.data ?? "");
        const image = await storeImage({
          db,
          bucket: env.IMAGES_BUCKET,
          bytes,
          declaredType: input.contentType ?? null,
          maxBytes: input.url ? MAX_IMAGE_BYTES : MAX_INLINE_IMAGE_BYTES,
        });
        schedulePurge(db, env.IMAGES_BUCKET, options.waitUntil);
        return mcpSuccess({
          imageId: image.id,
          contentType: image.contentType,
          byteSize: image.byteSize,
        });
      }),
    );
  if (allowed.has("create_image_upload"))
    server.registerTool(
      "create_image_upload",
      {
        title: "Create an image upload URL",
        description: [
          "Issue a one-time URL for uploading a local image file, valid for 10 minutes.",
          "Upload with: curl -fsS -X PUT --data-binary @photo.jpg -H 'Content-Type: image/jpeg' '<uploadUrl>'.",
          "The file must be of contentType and at most 10 MiB. After the upload succeeds, use imageId as coverImageId or in recipe.steps[].imageIds.",
        ].join(" "),
        inputSchema: createImageUploadInputSchema,
        outputSchema: output.imageUpload,
        annotations: create,
      },
      guard(async (input) => {
        const encryptionKey = env.SETTINGS_ENCRYPTION_KEY;
        if (!encryptionKey || !options.origin)
          throw new Error("Image uploads are not configured on this server.");
        const imageId = crypto.randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + uploadUrlLifetimeSeconds;
        const uploadUrl = await createSignedUploadUrl(
          options.origin,
          imageId,
          input.contentType,
          expiresAt,
          encryptionKey,
        );
        return mcpSuccess({
          imageId,
          uploadUrl,
          method: "PUT" as const,
          contentType: input.contentType,
          maxBytes: MAX_IMAGE_BYTES,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
        });
      }),
    );
  if (allowed.has("set_recipe_images"))
    server.registerTool(
      "set_recipe_images",
      {
        title: "Set recipe images",
        description:
          "Set the cover image and step images of a recipe without resending the recipe. Images removed this way are released and deleted after 24 hours unless used again. Each image can be used once across the recipe.",
        inputSchema: setRecipeImagesInputSchema,
        outputSchema: output.recipe,
        annotations: update,
      },
      guard(async (input) => {
        const recipe = await dishService.setImages(input.recipeId, {
          ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId } : {}),
          ...(input.stepImages ? { stepImages: input.stepImages } : {}),
        });
        if (!recipe) throw new Error(`Recipe not found: ${input.recipeId}`);
        return mcpSuccess({ recipe });
      }),
    );
  if (allowed.has("calculate_purchase_list"))
    server.registerTool(
      "calculate_purchase_list",
      {
        title: "Calculate purchase and shortage list",
        description:
          "Calculate inventory shortages, purchase amounts, unit costs, and output a unified Markdown table for a recipe. Stock comes from Inventia for ingredients linked to an Inventia item, then from the inventory argument, which wins on conflicts. inventiaStatus tells whether Inventia was read; warnings explain any lookup that failed.",
        inputSchema: calculatePurchaseListInputSchema,
        outputSchema: output.purchaseList,
        annotations: { ...readOnly, openWorldHint: true },
      },
      guard(async (input) => {
        let recipe = input.recipe;
        if (!recipe) {
          const targetId = input.dishId ?? input.recipeId;
          if (!targetId) throw new Error("Either recipe or dishId/recipeId must be provided");
          const dish = await dishService.get(targetId);
          if (!dish) throw new Error(`Dish not found: ${targetId}`);
          recipe = dish.recipe;
        }

        const ingredients = await ingredientService.list();
        const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
        const overrides = { ...input.inventory, ...input.inventoryOverrides };
        const inventory: Record<string, { currentQuantity: number; baseUnit: string }> = {};
        const warnings: string[] = [];
        // Widened on purpose: the callbacks below change it, which narrowing does not see.
        let inventiaStatus = "not_linked" as "used" | "unavailable" | "error" | "not_linked";

        const linked = [
          ...new Set(
            recipe.ingredients.flatMap((entry) => {
              const ingredient = byId.get(entry.ingredientId);
              return ingredient?.inventiaItemId && !(ingredient.id in overrides)
                ? [ingredient.id]
                : [];
            }),
          ),
        ];
        if (linked.length > 0) inventiaStatus = "used";
        for (
          let index = 0;
          index < linked.length && inventiaStatus !== "unavailable";
          index += stockLookupBatch
        ) {
          const batch = linked.slice(index, index + stockLookupBatch);
          const settled = await Promise.allSettled(
            batch.map((ingredientId) => ingredientService.inventiaStock(ingredientId)),
          );
          settled.forEach((result, position) => {
            const ingredientId = batch[position] ?? "";
            const name = byId.get(ingredientId)?.name ?? ingredientId;
            if (result.status === "fulfilled") {
              const stock = result.value;
              if (stock.found && stock.currentQuantity !== null)
                inventory[ingredientId] = {
                  currentQuantity: stock.currentQuantity,
                  baseUnit: stock.baseUnit ?? "",
                };
              else warnings.push(`${name}: the linked Inventia item was not found`);
              if (!stock.found || stock.currentQuantity === null) inventiaStatus = "error";
              return;
            }
            if (result.reason instanceof InventiaUnavailableError) {
              inventiaStatus = "unavailable";
              warnings.push(result.reason.message);
              return;
            }
            inventiaStatus = "error";
            const failure = toToolError(result.reason);
            warnings.push(
              `${name}: ${failure instanceof Error ? failure.message : "Inventia lookup failed"}`,
            );
          });
        }

        for (const [key, val] of Object.entries(overrides)) {
          if (typeof val === "number") {
            inventory[key] = { currentQuantity: val, baseUnit: "" };
          } else if (val && typeof val === "object") {
            inventory[key] = {
              currentQuantity: val.currentQuantity,
              baseUnit: val.baseUnit ?? "",
            };
          }
        }

        const result = calculatePurchaseList({ recipe, ingredients, inventory });
        return mcpSuccess({ ...result, inventiaStatus, warnings });
      }),
    );
  if (allowed.has("list_meals"))
    server.registerTool(
      "list_meals",
      {
        title: "List meals",
        description:
          "List recorded meals, newest first, optionally limited to an eatenAt range. Page with limit and offset; hasMore tells whether more remain.",
        inputSchema: listMealsInputSchema,
        outputSchema: output.meals,
        annotations: readOnly,
      },
      guard(async (input) => {
        const { meals } = await mealService.list({
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
        });
        return mcpSuccess({
          meals: meals.slice(input.offset, input.offset + input.limit),
          total: meals.length,
          hasMore: meals.length > input.offset + input.limit,
        });
      }),
    );
  if (allowed.has("get_meal"))
    server.registerTool(
      "get_meal",
      {
        title: "Get a meal",
        description: "Get one recorded meal by ID.",
        inputSchema: idInputSchema,
        outputSchema: output.meal,
        annotations: readOnly,
      },
      guard(async (input) => {
        const meal = await mealService.get(input.id);
        if (!meal) throw new Error(`Meal not found: ${input.id}`);
        return mcpSuccess({ meal });
      }),
    );
  if (allowed.has("record_meal"))
    server.registerTool(
      "record_meal",
      {
        title: "Record a meal",
        description:
          "Record a meal in Cho without changing Inventia stock. Pass id to make a retry safe: an existing meal with that ID is returned unchanged.",
        inputSchema: mealInput,
        outputSchema: output.mealCreated,
        annotations: create,
      },
      guard(async (input) => {
        if (input.id) {
          const existing = await mealService.get(input.id);
          if (existing) return mcpSuccess({ meal: existing, created: false });
        }
        return mcpSuccess({ meal: await mealService.create(input), created: true });
      }),
    );
  if (allowed.has("update_meal"))
    server.registerTool(
      "update_meal",
      {
        title: "Update a meal",
        description:
          "Update a recorded meal. Omitted fields are unchanged; items, when sent, replace all items. Inventia stock is not touched.",
        inputSchema: updateMealInput,
        outputSchema: output.meal,
        annotations: update,
      },
      guard(async (input) => {
        const { id, ...changes } = input;
        const meal = await mealService.update(
          id,
          Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
        );
        if (!meal) throw new Error(`Meal not found: ${id}`);
        return mcpSuccess({ meal });
      }),
    );
  if (allowed.has("delete_meal"))
    server.registerTool(
      "delete_meal",
      {
        title: "Delete a meal",
        description: "Delete a recorded meal. Inventia stock already consumed is not restored.",
        inputSchema: idInputSchema,
        outputSchema: output.deleteResult,
        annotations: destroy,
      },
      guard(async (input) => {
        const deleted = await mealService.delete(input.id);
        return mcpSuccess({ success: Boolean(deleted), deletedId: input.id });
      }),
    );
  return server;
}
