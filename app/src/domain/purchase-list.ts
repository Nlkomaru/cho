import type { Ingredient } from "./ingredient";
import { calculateIngredientCost } from "./ingredient";
import { recipeEntryName, type RecipeJson } from "./recipe";

export interface PurchaseListItem {
  ingredientId: string | null;
  name: string;
  requiredAmount: number;
  unit: string;
  stockQuantity: number | null;
  stockPresence: "sufficient" | "partial" | "none" | "unknown";
  shortageAmount: number;
  purchaseAmount: number;
  unitPriceYen: number | null;
  estimatedCostYen: number | null;
  isUnregistered: boolean;
}

export interface PurchaseListResult {
  items: PurchaseListItem[];
  totalEstimatedCostYen: number | null;
  /** Items with no price; the total only covers the others. */
  costMissingCount: number;
  markdownTable: string;
}

export interface InventoryItemInfo {
  currentQuantity: number;
  baseUnit?: string;
}

export interface CalculatePurchaseListParams {
  recipe: RecipeJson;
  ingredients: Ingredient[];
  inventory?: Record<string, InventoryItemInfo | number>;
}

/**
 * Resolves stock amount from the inventory mapping for a given recipe ingredient entry.
 * `name` is the name shown in the list (the master name, or the label of an unregistered entry).
 */
function resolveStockQuantity(
  entry: RecipeJson["ingredients"][number],
  matchedIngredient: Ingredient | undefined,
  name: string,
  inventory?: Record<string, InventoryItemInfo | number>,
): number | null {
  if (!inventory) return null;

  const candidateKeys = [
    matchedIngredient?.id,
    entry.ingredientId,
    matchedIngredient?.inventiaItemId,
    name,
  ].filter((key): key is string => Boolean(key));

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(inventory, key)) {
      const val = inventory[key];
      if (typeof val === "number" && Number.isFinite(val)) {
        return val;
      }
      if (
        val &&
        typeof val === "object" &&
        typeof val.currentQuantity === "number" &&
        Number.isFinite(val.currentQuantity)
      ) {
        return val.currentQuantity;
      }
    }
  }

  return null;
}

/**
 * Generates a unified Markdown table for the purchase and shortage list.
 */
function formatMarkdownTable(
  items: PurchaseListItem[],
  ingredients: Ingredient[],
  totalEstimatedCostYen: number | null,
): string {
  const header =
    "| 材料名 | 必要量 | 在庫量 | 在庫状況 | 不足量 | 買い足し量 | 参考単価 | 概算費用 | 登録状態 |";
  const separator = "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |";

  const rows = items.map((item) => {
    const matched = ingredients.find((i) => i.id === item.ingredientId);

    const stockQuantityStr =
      item.stockQuantity !== null ? `${item.stockQuantity}${item.unit}` : "-";

    let stockStatusStr: string;
    switch (item.stockPresence) {
      case "sufficient":
        stockStatusStr = "充足";
        break;
      case "partial":
        stockStatusStr = "一部あり";
        break;
      case "none":
        stockStatusStr = "なし";
        break;
      case "unknown":
      default:
        stockStatusStr = "不明";
        break;
    }

    const unitPriceStr = item.unitPriceYen !== null ? `${item.unitPriceYen}円` : "-";
    const costStr = item.estimatedCostYen !== null ? `${item.estimatedCostYen}円` : "-";

    const registrationStatusStr = item.isUnregistered
      ? "未登録"
      : matched?.inventiaItemId
        ? "連携済"
        : "登録済";

    return `| ${item.name} | ${item.requiredAmount}${item.unit} | ${stockQuantityStr} | ${stockStatusStr} | ${item.shortageAmount}${item.unit} | ${item.purchaseAmount}${item.unit} | ${unitPriceStr} | ${costStr} | ${registrationStatusStr} |`;
  });

  const totalCostStr = totalEstimatedCostYen !== null ? `${totalEstimatedCostYen}円` : "-";
  const totalRow = `| **合計** | - | - | - | - | - | - | **${totalCostStr}** | - |`;

  return [header, separator, ...rows, totalRow].join("\n");
}

/**
 * Calculates stock shortages, purchase restock quantities, estimated costs,
 * and outputs a single unified Markdown table for a recipe against current inventory.
 */
export function calculatePurchaseList({
  recipe,
  ingredients,
  inventory,
}: CalculatePurchaseListParams): PurchaseListResult {
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const items: PurchaseListItem[] = recipe.ingredients.map((entry) => {
    // 1. Identify matched ingredient from master catalog (by ID only; names are not unique)
    const matched = byId.get(entry.ingredientId);

    const isUnregistered = !matched;
    const ingredientId = matched ? matched.id : null;
    const unitPriceYen = matched?.latestUnitPriceYen ?? null;
    // What to buy is the ingredient itself, so prefer its name over the recipe wording
    const name = matched?.name ?? recipeEntryName(entry, byId);

    // 2. Determine stock quantity and presence
    const stockQuantity = resolveStockQuantity(entry, matched, name, inventory);

    let stockPresence: PurchaseListItem["stockPresence"];
    let shortageAmount: number;
    let purchaseAmount: number;

    if (stockQuantity === null) {
      stockPresence = "unknown";
      shortageAmount = entry.amount;
      purchaseAmount = entry.amount;
    } else if (stockQuantity >= entry.amount) {
      stockPresence = "sufficient";
      shortageAmount = 0;
      purchaseAmount = 0;
    } else if (stockQuantity > 0) {
      stockPresence = "partial";
      shortageAmount = Math.max(
        0,
        Math.round((entry.amount - stockQuantity + Number.EPSILON) * 1000) / 1000,
      );
      purchaseAmount = shortageAmount;
    } else {
      stockPresence = "none";
      shortageAmount = entry.amount;
      purchaseAmount = entry.amount;
    }

    // 3. Compute item estimated cost
    let estimatedCostYen: number | null = null;
    if (purchaseAmount === 0) {
      estimatedCostYen = 0;
    } else if (matched && matched.latestUnitPriceYen !== null) {
      const cost = calculateIngredientCost(matched, purchaseAmount);
      estimatedCostYen = cost !== null ? Math.round((cost + Number.EPSILON) * 100) / 100 : null;
    }

    return {
      ingredientId,
      name,
      requiredAmount: entry.amount,
      unit: entry.unit,
      stockQuantity,
      stockPresence,
      shortageAmount,
      purchaseAmount,
      unitPriceYen,
      estimatedCostYen,
      isUnregistered,
    };
  });

  // Compute total estimated cost across all items with known costs
  const costItems = items.filter((i) => i.estimatedCostYen !== null);
  const totalEstimatedCostYen =
    costItems.length > 0
      ? Math.round(
          (costItems.reduce((acc, i) => acc + (i.estimatedCostYen ?? 0), 0) + Number.EPSILON) * 100,
        ) / 100
      : null;

  // Render Markdown table
  const markdownTable = formatMarkdownTable(items, ingredients, totalEstimatedCostYen);

  return {
    items,
    totalEstimatedCostYen,
    costMissingCount: items.length - costItems.length,
    markdownTable,
  };
}
