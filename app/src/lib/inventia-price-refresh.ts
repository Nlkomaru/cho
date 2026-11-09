import { z } from "zod";

import { ingredientSchema, type Ingredient } from "@/domain/ingredient";

const refreshResultSchema = z.object({ ingredients: z.array(ingredientSchema) });

/**
 * 古くなった Inventia の単価を取り直す。画面の表示を待たせないよう、読み込み後に呼ぶ。
 * 更新された材料だけを返し、失敗しても画面には出さない (キャッシュの値をそのまま使う)。
 */
export async function refreshStaleInventiaPrices(
  ingredientIds?: readonly string[],
): Promise<Ingredient[]> {
  try {
    const response = await fetch("/api/ingredients/refresh-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingredientIds ? { ingredientIds } : {}),
    });
    if (!response.ok) return [];
    const parsed = refreshResultSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.ingredients : [];
  } catch {
    return [];
  }
}
