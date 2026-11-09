import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";
import type { Dish, Ingredient } from "@/domain/ingredient";
import type { RecipeGanttSchedule } from "@/domain/recipe-scheduler";
import { errorMessageFrom } from "@/lib/api-error";

import { DishDetailSkeleton, DishDetailView } from "./-components/dish-detail-view";
import { RecipeMetaDialog, type RecipeMetaValues } from "./-components/recipe-meta-dialog";

export const Route = createFileRoute("/_app/dishes/$dishId/")({
  staticData: { breadcrumbs: [{ label: "レシピ詳細" }] },
  component: DishDetailPage,
});

type Detail = { dish: Dish; schedule: RecipeGanttSchedule };

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ApiError(
      errorMessageFrom(body, `通信に失敗しました (${response.status})`),
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

function DishDetailPage() {
  const { dishId } = Route.useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [master, setMaster] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!options.quiet) setLoading(true);
      try {
        const [data, ingredients] = await Promise.all([
          api<Detail>(`/api/dishes/${encodeURIComponent(dishId)}`),
          api<Ingredient[]>("/api/ingredients"),
        ]);
        setDetail(data);
        setMaster(ingredients);
        setLoadError(null);
      } catch (cause) {
        setLoadError({
          message: messageOf(cause, "レシピを読み込めませんでした。"),
          notFound: cause instanceof ApiError && cause.status === 404,
        });
      } finally {
        setLoading(false);
      }
    },
    [dishId],
  );

  useEffect(() => {
    setDetail(null);
    void load();
  }, [load]);

  const ingredientById = useMemo(() => new Map(master.map((item) => [item.id, item])), [master]);

  async function saveMeta(values: RecipeMetaValues) {
    if (!detail) return;
    setMetaBusy(true);
    setMetaError("");
    try {
      await api<Dish>(`/api/dishes/${encodeURIComponent(detail.dish.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setMetaOpen(false);
      toaster.create({ type: "success", title: "保存しました" });
      await load({ quiet: true });
    } catch (cause) {
      setMetaError(messageOf(cause, "変更を保存できませんでした。"));
    } finally {
      setMetaBusy(false);
    }
  }

  async function deleteDish() {
    if (!detail) return;
    setDeleteBusy(true);
    try {
      await api(`/api/dishes/${encodeURIComponent(detail.dish.id)}`, { method: "DELETE" });
      setDeleteOpen(false);
      toaster.create({ type: "success", title: `「${detail.dish.name}」を削除しました` });
      await navigate({ to: "/dishes" });
    } catch (cause) {
      setDeleteOpen(false);
      toaster.create({
        type: "error",
        title: "削除できませんでした",
        description: messageOf(cause, "時間をおいてもう一度お試しください。"),
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading && !detail) return <DishDetailSkeleton />;

  if (!detail) {
    if (loadError?.notFound)
      return (
        <Page>
          <PageHeader
            title="レシピが見つかりません"
            breadcrumbs={[{ label: "レシピ", to: "/dishes" }]}
          />
          <EmptyState
            icon={<SearchX strokeWidth={1.75} />}
            title="削除されたか、URL が正しくありません"
            action={
              <Button asChild variant="outline">
                <Link to="/dishes">レシピ一覧へ</Link>
              </Button>
            }
          />
        </Page>
      );
    return (
      <Page>
        <Feedback
          tone="error"
          title="レシピを読み込めませんでした"
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              再読み込み
            </Button>
          }
        >
          {loadError?.message}
        </Feedback>
      </Page>
    );
  }

  const { dish, schedule } = detail;

  return (
    <>
      <DishDetailView
        key={dish.id}
        dish={dish}
        schedule={schedule}
        ingredientById={ingredientById}
        onEditMeta={() => {
          setMetaError("");
          setMetaOpen(true);
        }}
        onDelete={() => setDeleteOpen(true)}
      />
      <RecipeMetaDialog
        open={metaOpen}
        onOpenChange={setMetaOpen}
        initial={{ name: dish.name, category: dish.category, notes: dish.notes }}
        busy={metaBusy}
        error={metaError}
        onSubmit={(values) => void saveMeta(values)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="このレシピを削除しますか？"
        description={`「${dish.name}」を削除します。元に戻せません。`}
        confirmLabel="削除する"
        tone="danger"
        busy={deleteBusy}
        onConfirm={() => void deleteDish()}
      />
    </>
  );
}
