import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { toaster } from "@/components/ui/toaster";
import type { Ingredient } from "@/domain/ingredient";
import { errorMessageFrom } from "@/lib/api-error";
import { refreshStaleInventiaPrices } from "@/lib/inventia-price-refresh";

import { IngredientEditorDrawer } from "./-components/ingredient-editor-drawer";
import type { EstimateResult, IngredientPayload } from "./-components/ingredient-form";
import { IngredientListView } from "./-components/ingredient-list-view";
import type { InventiaActions, InventiaItem } from "./-components/inventia-link-panel";

export const Route = createFileRoute("/_app/ingredients/")({
  staticData: { breadcrumbs: [{ label: "材料" }] },
  component: IngredientsPage,
});

const stockResultResponseSchema = z
  .object({
    found: z.boolean(),
    currentQuantity: z.number().nullable(),
    baseUnit: z.string().nullable(),
  })
  .strict();
type LinkResult =
  | { synced: true; ingredient: Ingredient; unitPriceYen: number }
  | { synced: false; reason: "no_price_records" | "price_unavailable"; ingredient: Ingredient };

const stockAdjustResponseSchema = z
  .object({ currentQuantity: z.number(), allocations: z.array(z.unknown()) })
  .strict();

/** JSON を送受信し、失敗時は API のエラーメッセージで Error を投げる。 */
async function request<T>(
  url: string,
  fallback: string,
  init?: { method: string; body?: unknown },
) {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(errorMessageFrom(body, fallback));
  return body as T;
}

function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await request<Ingredient[]>("/api/ingredients", "材料を読み込めませんでした。"));
      // 一覧を出してから古い単価を取り直し、更新された行だけ差し替える
      void refreshStaleInventiaPrices().then((updated) => {
        if (updated.length === 0) return;
        const byId = new Map(updated.map((item) => [item.id, item]));
        setItems((current) => current.map((item) => byId.get(item.id) ?? item));
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIngredients();
  }, [loadIngredients]);

  const editing = editingId ? (items.find((item) => item.id === editingId) ?? null) : null;

  const replaceItem = (ingredient: Ingredient) =>
    setItems((current) => current.map((item) => (item.id === ingredient.id ? ingredient : item)));

  function openEditor(item: Ingredient | null) {
    setEditingId(item?.id ?? null);
    setDrawerOpen(true);
  }

  async function save(payload: IngredientPayload) {
    const ingredient = await request<Ingredient>(
      editingId ? `/api/ingredients/${encodeURIComponent(editingId)}` : "/api/ingredients",
      "材料を保存できませんでした。",
      { method: editingId ? "PATCH" : "POST", body: payload },
    );
    setItems((current) =>
      editingId
        ? current.map((item) => (item.id === ingredient.id ? ingredient : item))
        : [...current, ingredient],
    );
    setDrawerOpen(false);
    toaster.create({
      type: "success",
      title: editingId ? "保存しました" : "材料を追加しました",
    });
  }

  async function remove(ingredient: Ingredient) {
    await request<void>(
      `/api/ingredients/${encodeURIComponent(ingredient.id)}`,
      "材料を削除できませんでした。",
      {
        method: "DELETE",
      },
    );
    setItems((current) => current.filter((item) => item.id !== ingredient.id));
    setDrawerOpen(false);
    setEditingId(null);
    toaster.create({ type: "success", title: "削除しました" });
  }

  const estimate = (input: Pick<IngredientPayload, "name" | "baseDimension" | "baseUnit">) =>
    request<EstimateResult>("/api/ai/estimate-ingredient", "栄養価を推定できませんでした。", {
      method: "POST",
      body: input,
    });

  const inventia = useMemo<InventiaActions>(
    () => ({
      search: (query) =>
        request<InventiaItem[]>(
          "/api/ingredients/search-inventia",
          "Inventia を検索できませんでした。",
          {
            method: "POST",
            body: { query },
          },
        ),
      async link(ingredientId, itemId) {
        const result = await request<LinkResult>(
          "/api/ingredients/sync-inventia",
          "Inventia と連携できませんでした。",
          { method: "POST", body: { ingredientId, itemId } },
        );
        replaceItem(result.ingredient);
        toaster.create(
          result.synced
            ? { type: "success", title: "Inventia と連携し、単価を取り込みました" }
            : {
                type: "info",
                title: "Inventia と連携しました",
                description:
                  result.reason === "price_unavailable"
                    ? "単価を取得できませんでした。次に開いたときに取り直します。"
                    : "この品目には価格の記録がないため、単価は未登録です。",
              },
        );
        return result;
      },
      async readStock(ingredientId) {
        const body = await request<unknown>(
          `/api/ingredients/${encodeURIComponent(ingredientId)}/stock`,
          "在庫を取得できませんでした。",
        );
        return stockResultResponseSchema.parse(body);
      },
      async consumeStock(ingredientId, amount, idempotencyKey) {
        const body = await request<unknown>(
          `/api/ingredients/${encodeURIComponent(ingredientId)}/stock`,
          "在庫を消費できませんでした。",
          { method: "POST", body: { amount, idempotencyKey } },
        );
        const result = stockAdjustResponseSchema.parse(body);
        toaster.create({ type: "success", title: "在庫を消費しました" });
        return result;
      },
    }),
    [],
  );

  return (
    <>
      <IngredientListView
        items={items}
        loading={loading}
        error={error}
        onRetry={() => void loadIngredients()}
        query={query}
        onQueryChange={setQuery}
        selectedId={drawerOpen ? editingId : null}
        onSelect={openEditor}
        onAdd={() => openEditor(null)}
      />
      <IngredientEditorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ingredient={editing}
        onSave={save}
        onDelete={remove}
        onEstimate={estimate}
        inventia={inventia}
      />
    </>
  );
}
