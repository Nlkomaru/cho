import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Dish } from "@/domain/ingredient";
import { errorMessageFrom } from "@/lib/api-error";

import { DishListView } from "./-components/dish-list-view";
import { toDishRow } from "./-components/dish-table";

export const Route = createFileRoute("/_app/dishes/")({
  staticData: { breadcrumbs: [{ label: "レシピ" }] },
  component: DishListPage,
});

async function api<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(errorMessageFrom(body, `通信に失敗しました (${response.status})`));
  }
  return response.json() as Promise<T>;
}

function DishListPage() {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDishes(await api<Dish[]>("/api/dishes"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "レシピを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => dishes.map(toDishRow), [dishes]);

  return (
    <DishListView
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void refresh()}
      query={query}
      onQueryChange={setQuery}
      onSelect={(row) => void navigate({ to: "/dishes/$dishId", params: { dishId: row.id } })}
    />
  );
}
