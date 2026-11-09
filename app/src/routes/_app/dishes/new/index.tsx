import { Box, Skeleton, Stack } from "@chakra-ui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";
import type { Dish, Ingredient } from "@/domain/ingredient";
import type { RecipeJson } from "@/domain/recipe";
import { errorMessageFrom } from "@/lib/api-error";

import { EDITOR_MAX_W } from "./-components/editor-action-bar";
import { blankDraft, type RecipeDraft } from "./-components/recipe-draft";
import {
  RecipeEditor,
  type RecipeSavePayload,
  type RecipeStructureRequest,
} from "./-components/recipe-editor";

export const Route = createFileRoute("/_app/dishes/new/")({
  validateSearch: (search: Record<string, unknown>) => ({
    dishId: typeof search.dishId === "string" ? search.dishId : undefined,
  }),
  staticData: { breadcrumbs: [{ label: "レシピ作成" }] },
  component: NewDishPage,
});

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new Error(errorMessageFrom(body, `通信に失敗しました (${response.status})`));
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ingredients: Ingredient[]; draft: RecipeDraft; dish?: Dish };

function NewDishPage() {
  const navigate = useNavigate();
  const { dishId } = Route.useSearch();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    void Promise.all([
      api<Ingredient[]>("/api/ingredients"),
      dishId
        ? api<{ dish: Dish }>(`/api/dishes/${encodeURIComponent(dishId)}`)
        : Promise.resolve(null),
    ])
      .then(([ingredients, detail]) => {
        if (!live) return;
        const dish = detail?.dish;
        setState({
          status: "ready",
          ingredients,
          dish,
          draft: dish
            ? {
                name: dish.name,
                category: dish.category ?? "",
                servings: String(dish.servings),
                recipe: dish.recipe,
              }
            : blankDraft(),
        });
      })
      .catch((cause) => {
        if (live)
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "レシピ情報を読み込めませんでした。",
          });
      });
    return () => {
      live = false;
    };
  }, [dishId, reload]);

  const save = useCallback(
    async (common: RecipeSavePayload) => {
      const payload = dishId ? common : { ...common, coverImageId: null, notes: null };
      const dish = await api<Dish>(
        dishId ? `/api/dishes/${encodeURIComponent(dishId)}` : "/api/dishes",
        {
          method: dishId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      toaster.create({ type: "success", title: "保存しました" });
      await navigate({ to: "/dishes/$dishId", params: { dishId: dish.id } });
    },
    [dishId, navigate],
  );

  const structure = useCallback(
    (request: RecipeStructureRequest) =>
      api<RecipeJson>("/api/ai/structure-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    [],
  );

  const cancel = useCallback(() => {
    if (dishId) void navigate({ to: "/dishes/$dishId", params: { dishId } });
    else void navigate({ to: "/dishes" });
  }, [dishId, navigate]);

  if (state.status !== "ready") {
    const title = dishId ? "レシピを編集" : "レシピを作成";
    return (
      <Page size="lg">
        <Box maxW={EDITOR_MAX_W}>
          <PageHeader title={title} breadcrumbs={[{ label: "レシピ", to: "/dishes" }]} />
        </Box>
        {state.status === "error" ? (
          <Feedback
            tone="error"
            title="読み込めませんでした"
            action={
              <Button variant="outline" size="sm" onClick={() => setReload((count) => count + 1)}>
                再読み込み
              </Button>
            }
          >
            {state.message}
          </Feedback>
        ) : (
          <Stack
            gap="6"
            maxW={{ lg: "800px" }}
            ms={{ lg: "calc(200px + {spacing.16})" }}
            aria-busy="true"
          >
            <Skeleton h="8" w="40%" />
            <Skeleton h="10" />
            <Skeleton h="24" />
            <Skeleton h="8" w="30%" />
            <Skeleton h="40" />
          </Stack>
        )}
      </Page>
    );
  }

  return (
    <RecipeEditor
      key={state.dish?.id ?? "new"}
      mode={dishId ? "edit" : "create"}
      initial={state.draft}
      ingredients={state.ingredients}
      dish={state.dish ? { id: state.dish.id, name: state.dish.name } : undefined}
      onSave={save}
      onStructure={structure}
      onCancel={cancel}
    />
  );
}
