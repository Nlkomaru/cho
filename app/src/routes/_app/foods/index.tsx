import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { toaster } from "@/components/ui/toaster";
import type { Food } from "@/domain/ingredient";
import { errorMessageFrom } from "@/lib/api-error";

import { FoodEditorDrawer } from "./-components/food-editor-drawer";
import type { FoodPayload } from "./-components/food-form";
import { FoodListView } from "./-components/food-list-view";

export const Route = createFileRoute("/_app/foods/")({
  staticData: { breadcrumbs: [{ label: "定番食品" }] },
  component: FoodsPage,
});

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

function FoodsPage() {
  const [items, setItems] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadFoods = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await request<Food[]>("/api/foods", "定番食品を読み込めませんでした。"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "定番食品を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFoods();
  }, [loadFoods]);

  const editing = editingId ? (items.find((item) => item.id === editingId) ?? null) : null;

  function openEditor(item: Food | null) {
    setEditingId(item?.id ?? null);
    setDrawerOpen(true);
  }

  async function save(payload: FoodPayload) {
    const food = await request<Food>(
      editingId ? `/api/foods/${encodeURIComponent(editingId)}` : "/api/foods",
      "定番食品を保存できませんでした。",
      { method: editingId ? "PATCH" : "POST", body: payload },
    );
    setItems((current) =>
      editingId ? current.map((item) => (item.id === food.id ? food : item)) : [...current, food],
    );
    setDrawerOpen(false);
    toaster.create({
      type: "success",
      title: editingId ? "保存しました" : "定番食品を追加しました",
    });
  }

  async function remove(food: Food) {
    await request<void>(
      `/api/foods/${encodeURIComponent(food.id)}`,
      "定番食品を削除できませんでした。",
      { method: "DELETE" },
    );
    setItems((current) => current.filter((item) => item.id !== food.id));
    setDrawerOpen(false);
    setEditingId(null);
    toaster.create({ type: "success", title: "削除しました" });
  }

  return (
    <>
      <FoodListView
        items={items}
        loading={loading}
        error={error}
        onRetry={() => void loadFoods()}
        query={query}
        onQueryChange={setQuery}
        selectedId={drawerOpen ? editingId : null}
        onSelect={openEditor}
        onAdd={() => openEditor(null)}
      />
      <FoodEditorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        food={editing}
        onSave={save}
        onDelete={remove}
      />
    </>
  );
}
