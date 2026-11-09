import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { Page } from "@/components/layout/page";
import { MealEntryDrawer } from "@/components/meal/meal-entry-drawer";
import { MealListView } from "@/components/meal/meal-list-view";
import {
  api,
  localCalendarDate,
  periodRange,
  type Meal,
  type MealListResponse,
  type MealPeriod,
  type MealView,
  type Source,
  type Timing,
} from "@/components/meal/meal-shared";

const mealSearchSchema = z.object({
  dishId: z.string().trim().min(1).optional(),
  servings: z.coerce.number().positive().finite().optional(),
});

export const Route = createFileRoute("/_app/")({
  validateSearch: mealSearchSchema,
  staticData: { breadcrumbs: [{ label: "食事記録" }] },
  component: MealListPage,
});

function MealListPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [open, setOpen] = useState(Boolean(search.dishId));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<MealPeriod>("week");
  // サーバーとブラウザで日付がずれないよう、基準日はブラウザで決める
  const [anchor, setAnchor] = useState("");
  const [source, setSource] = useState<Source | "">("");
  const [timing, setTiming] = useState<Timing | "">("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<MealView>("cards");
  const [deferredQuery, setDeferredQuery] = useState("");

  // 入力のたびに問い合わせないよう、検索語は少し待ってから反映する
  useEffect(() => {
    const timer = setTimeout(() => setDeferredQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setAnchor(localCalendarDate(new Date()));
  }, []);

  const refresh = useCallback(async () => {
    if (!anchor) return;
    setLoading(true);
    const { start, end } = periodRange(period, anchor);
    const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
    if (source) params.set("sourceType", source);
    if (timing) params.set("mealTiming", timing);
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    try {
      const result = await api<MealListResponse>(`/api/meals?${params}`);
      setMeals(result.meals);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [period, anchor, source, timing, deferredQuery]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const closeDrawer = () => {
    setOpen(false);
    if (search.dishId) void navigate({ search: {}, replace: true });
  };

  return (
    <Page size="lg">
      <MealListView
        meals={meals}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        onAdd={() => setOpen(true)}
        period={period}
        onPeriodChange={setPeriod}
        anchor={anchor}
        onAnchorChange={setAnchor}
        query={query}
        onQueryChange={setQuery}
        source={source}
        onSourceChange={setSource}
        timing={timing}
        onTimingChange={setTiming}
        view={view}
        onViewChange={setView}
      />
      <MealEntryDrawer
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : closeDrawer())}
        initialDishId={search.dishId}
        initialServings={search.servings ?? 1}
        onSaved={async () => {
          closeDrawer();
          await refresh();
        }}
      />
    </Page>
  );
}
