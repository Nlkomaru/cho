import { Stack } from "@chakra-ui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { MealEntryDrawer } from "@/components/meal/meal-entry-drawer";
import { MealDetailSkeleton, MealDetailView } from "@/components/meal/meal-detail-view";
import { api, type Meal } from "@/components/meal/meal-shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";

export const Route = createFileRoute("/_app/meals/$mealId/")({
  staticData: { breadcrumbs: [{ label: "食事詳細" }] },
  component: MealDetailPage,
});

function MealDetailPage() {
  const { mealId } = Route.useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stockWorking, setStockWorking] = useState(false);
  const [stockError, setStockError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const url = `/api/meals/${encodeURIComponent(mealId)}`;

  const load = useCallback(async () => {
    try {
      setMeal(await api<Meal>(url));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function consumeStock() {
    setStockWorking(true);
    setStockError("");
    try {
      await api<unknown>(`${url}/consume-stock`, { method: "POST" });
      toaster.create({ type: "success", title: "在庫を消費しました" });
    } catch (cause) {
      setStockError(cause instanceof Error ? cause.message : "在庫消費に失敗しました。");
    } finally {
      await load();
      setStockWorking(false);
    }
  }

  async function deleteMeal() {
    setDeleting(true);
    try {
      await api<void>(url, { method: "DELETE" });
      toaster.create({ type: "success", title: "食事記録を削除しました" });
      setConfirmDelete(false);
      await navigate({ to: "/" });
    } catch (cause) {
      toaster.create({
        type: "error",
        title: "削除できませんでした",
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Page size="lg">
        <MealDetailSkeleton />
      </Page>
    );
  }

  if (!meal) {
    return (
      <Page size="lg">
        <PageHeader
          size="display"
          breadcrumbs={[{ label: "食事記録", to: "/" }]}
          title="食事記録を表示できません"
        />
        <Stack gap="4" align="flex-start">
          <Feedback
            tone="error"
            action={
              <Button variant="outline" size="sm" onClick={() => void load()}>
                再読み込み
              </Button>
            }
          >
            {error || "食事記録が見つかりません。"}
          </Feedback>
        </Stack>
      </Page>
    );
  }

  return (
    <Page size="lg">
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      <MealDetailView
        meal={meal}
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmDelete(true)}
        stockWorking={stockWorking}
        stockError={stockError}
        onConsumeStock={() => void consumeStock()}
      />
      <MealEntryDrawer
        open={editing}
        onOpenChange={setEditing}
        meal={meal}
        onSaved={async () => {
          setEditing(false);
          await load();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="この食事記録を削除しますか？"
        description={`「${meal.title}」を削除します。元に戻せません。`}
        confirmLabel="削除"
        busy={deleting}
        onConfirm={() => void deleteMeal()}
      />
    </Page>
  );
}
