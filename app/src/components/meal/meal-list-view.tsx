import { Stack, chakra } from "@chakra-ui/react";
import { Plus, UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Feedback } from "@/components/ui/feedback";

import { MealJournal, MealJournalSkeleton } from "./meal-journal";
import { groupMealsByDay, summarizeMeals, type Meal } from "./meal-shared";
import { MealStats } from "./meal-stats";
import { MealTable } from "./meal-table";
import { MealToolbar, type MealToolbarProps } from "./meal-toolbar";

export interface MealListViewProps extends MealToolbarProps {
  meals: readonly Meal[];
  loading?: boolean;
  error?: string;
  onRetry?(): void;
  onAdd(): void;
}

/**
 * 食事記録ページの本体 (データ取得なし)。見出し → 操作列 → 期間の集計 → 一覧。
 */
export function MealListView({
  meals,
  loading,
  error,
  onRetry,
  onAdd,
  ...toolbar
}: MealListViewProps) {
  const days = useMemo(() => groupMealsByDay(meals), [meals]);
  const totals = useMemo(() => (loading ? null : summarizeMeals(meals)), [loading, meals]);
  const filtered = Boolean(toolbar.query.trim() || toolbar.source || toolbar.timing);

  const empty = (
    <EmptyState
      icon={<UtensilsCrossed strokeWidth={1.75} />}
      title={filtered ? "条件に合う記録はありません" : "この期間の記録はありません"}
      action={
        filtered ? undefined : (
          <Button variant="outline" onClick={onAdd}>
            <Plus strokeWidth={1.75} />
            記録を追加
          </Button>
        )
      }
    />
  );

  return (
    <>
      <PageHeader
        title="食事記録"
        actions={
          <Button variant="primary" onClick={onAdd}>
            <Plus strokeWidth={1.75} />
            記録を追加
          </Button>
        }
      />
      <Stack gap={{ base: "6", md: "8" }}>
        <MealToolbar {...toolbar} />
        <MealStats label="期間の集計" totals={totals} />
      </Stack>
      {error ? (
        <Feedback
          tone="error"
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                再読み込み
              </Button>
            ) : undefined
          }
        >
          {error}
        </Feedback>
      ) : toolbar.view === "table" ? (
        <MealTable meals={meals} loading={loading} empty={empty} />
      ) : loading ? (
        <MealJournalSkeleton />
      ) : meals.length === 0 ? (
        <section aria-labelledby="meal-list-empty-heading">
          {/* 空状態の見出し (h3) の親になる見出し */}
          <chakra.h2 id="meal-list-empty-heading" srOnly>
            食事の一覧
          </chakra.h2>
          {empty}
        </section>
      ) : (
        <MealJournal days={days} />
      )}
    </>
  );
}
