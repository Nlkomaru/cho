import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    baseDimension: text("base_dimension", { enum: ["mass", "volume", "count"] }).notNull(),
    baseUnit: text("base_unit").notNull(),
    nutritionBasisAmount: real("nutrition_basis_amount").notNull(),
    nutritionJson: text("nutrition_json").notNull(),
    gramPerUnit: real("gram_per_unit"),
    inventiaItemId: text("inventia_item_id"),
    latestUnitPriceYen: real("latest_unit_price_yen"),
    latestPriceUpdatedAt: text("latest_price_updated_at"),
    memo: text("memo"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ingredients_normalized_name_uq").on(table.normalizedName),
    index("ingredients_inventia_item_idx").on(table.inventiaItemId),
    check("ingredients_basis_amount_positive", sql`${table.nutritionBasisAmount} > 0`),
  ],
);

export const dishes = sqliteTable(
  "dishes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"),
    servings: integer("servings").notNull(),
    recipeJson: text("recipe_json").notNull(),
    cachedTotalNutritionJson: text("cached_total_nutrition_json"),
    cachedTotalCostYen: real("cached_total_cost_yen"),
    coverImageId: text("cover_image_id").references(() => mediaImages.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [check("dishes_servings_positive", sql`${table.servings} > 0`)],
);

export const dishIngredients = sqliteTable(
  "dish_ingredients",
  {
    id: text("id").primaryKey(),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    recipeEntryId: text("recipe_entry_id").notNull(),
    amount: real("amount").notNull(),
    displayAmount: text("display_amount").notNull(),
    role: text("role", { enum: ["main", "seasoning", "topping", "optional"] }).notNull(),
    groupSymbol: text("group_symbol"),
    groupLabel: text("group_label"),
    prepNote: text("prep_note"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("dish_ingredients_recipe_entry_uq").on(table.dishId, table.recipeEntryId),
    index("dish_ingredients_dish_order_idx").on(table.dishId, table.sortOrder),
    index("dish_ingredients_ingredient_idx").on(table.ingredientId),
    check("dish_ingredients_amount_positive", sql`${table.amount} > 0`),
  ],
);

export const mealLogs = sqliteTable(
  "meal_logs",
  {
    id: text("id").primaryKey(),
    eatenAt: text("eaten_at").notNull(),
    mealTiming: text("meal_timing"),
    sourceType: text("source_type", {
      enum: [
        "self_cooked",
        "cafeteria",
        "convenience",
        "supermarket",
        "snack",
        "restaurant",
        "other",
      ],
    }).notNull(),
    placeName: text("place_name"),
    title: text("title").notNull(),
    totalPriceYen: real("total_price_yen"),
    totalNutritionJson: text("total_nutrition_json"),
    rating: integer("rating"),
    memo: text("memo"),
    inventiaConsumptionStatus: text("inventia_consumption_status"),
    ...timestamps,
  },
  (table) => [index("meal_logs_eaten_at_idx").on(table.eatenAt)],
);

export const mealLogItems = sqliteTable(
  "meal_log_items",
  {
    id: text("id").primaryKey(),
    mealLogId: text("meal_log_id")
      .notNull()
      .references(() => mealLogs.id, { onDelete: "cascade" }),
    dishId: text("dish_id").references(() => dishes.id, { onDelete: "set null" }),
    ingredientId: text("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    servingsFactor: real("servings_factor").notNull().default(1),
    priceYen: real("price_yen"),
    nutritionJson: text("nutrition_json"),
    ingredientCostBreakdownJson: text("ingredient_cost_breakdown_json"),
    estimationSource: text("estimation_source"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("meal_log_items_log_order_idx").on(table.mealLogId, table.sortOrder),
    index("meal_log_items_dish_idx").on(table.dishId),
    index("meal_log_items_ingredient_idx").on(table.ingredientId),
  ],
);

export const mediaImages = sqliteTable(
  "media_images",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurhash: text("blurhash"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("media_images_object_key_uq").on(table.objectKey),
    index("media_images_target_order_idx").on(table.targetType, table.targetId, table.sortOrder),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key", { enum: ["openrouter", "inventia"] }).primaryKey(),
  encryptedPayload: text("encrypted_payload").notNull(),
  publicConfigJson: text("public_config_json"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
export const mcpApiTokens = sqliteTable(
  "mcp_api_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerSubject: text("owner_subject").notNull(),
    prefix: text("prefix").notNull(),
    secretHash: text("secret_hash").notNull().unique(),
    allowedTools: text("allowed_tools").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    lastUsedAt: text("last_used_at"),
  },
  (table) => [index("mcp_api_tokens_owner_idx").on(table.ownerSubject, table.createdAt)],
);

export const mcpToolUsageDaily = sqliteTable(
  "mcp_tool_usage_daily",
  {
    tokenId: text("token_id")
      .notNull()
      .references(() => mcpApiTokens.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    utcDate: text("utc_date").notNull(),
    callCount: integer("call_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.tokenId, table.toolName, table.utcDate] }),
    index("mcp_tool_usage_date_idx").on(table.utcDate),
    check("mcp_tool_usage_count_nonnegative", sql`${table.callCount} >= 0`),
  ],
);

export const dishRelations = relations(dishes, ({ many }) => ({
  ingredients: many(dishIngredients),
}));
export const dishIngredientRelations = relations(dishIngredients, ({ one }) => ({
  dish: one(dishes, { fields: [dishIngredients.dishId], references: [dishes.id] }),
  ingredient: one(ingredients, {
    fields: [dishIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));
export const mealLogRelations = relations(mealLogs, ({ many }) => ({ items: many(mealLogItems) }));
export const mealLogItemRelations = relations(mealLogItems, ({ one }) => ({
  mealLog: one(mealLogs, { fields: [mealLogItems.mealLogId], references: [mealLogs.id] }),
  dish: one(dishes, { fields: [mealLogItems.dishId], references: [dishes.id] }),
  ingredient: one(ingredients, {
    fields: [mealLogItems.ingredientId],
    references: [ingredients.id],
  }),
}));
