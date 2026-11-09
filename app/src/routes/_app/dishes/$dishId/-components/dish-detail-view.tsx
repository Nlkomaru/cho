import { Badge, Box, Grid, HStack, Menu, Portal, Skeleton, Stack, Switch } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { NutritionSummary } from "@/components/food/nutrition-summary";
import { Page } from "@/components/layout/page";
import { MetaSeparator, PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import {
  buildIngredientGroups,
  buildIngredientItems,
  sumIngredientItems,
} from "@/components/recipe/build-ingredient-items";
import { GanttChart, type GanttChartHandle } from "@/components/recipe/gantt-chart";
import { IngredientList } from "@/components/recipe/ingredient-list";
import { RecipeCover } from "@/components/recipe/recipe-image";
import { RecipeNotes } from "@/components/recipe/recipe-notes";
import { StepList } from "@/components/recipe/step-list";
import { Button, IconButton } from "@/components/ui/button";
import { ServingsStepper } from "@/components/ui/servings-stepper";
import type { Dish, Ingredient } from "@/domain/ingredient";
import type { RecipeGanttSchedule } from "@/domain/recipe-scheduler";
import { formatMinutes } from "@/lib/format";

export interface DishDetailViewProps {
  dish: Dish;
  schedule: RecipeGanttSchedule;
  /** 材料名・栄養価・原価に使う材料マスタ。 */
  ingredientById: ReadonlyMap<string, Ingredient>;
  /** 最初に表示する人前数。既定はレシピの基準人前。 */
  initialServings?: number;
  /** 最初から完了扱いにする手順 (Storybook 用)。 */
  initialCompletedStepIds?: readonly string[];
  onEditMeta?(): void;
  onDelete?(): void;
}

const BREADCRUMBS = [{ label: "レシピ", to: "/dishes" }] as const;

const scrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    ? "auto"
    : "smooth";

/**
 * レシピ詳細の本文。表紙画像 (あれば) → 工程表 → 材料 → 手順の順に並べ、lg 以上では右に栄養価と補足の列を置く。
 * データの取得と更新は route 側が持ち、ここでは表示用の状態 (人前・完了・選択中の手順) だけを持つ。
 */
export function DishDetailView({
  dish,
  schedule,
  ingredientById,
  initialServings,
  initialCompletedStepIds = [],
  onEditMeta,
  onDelete,
}: DishDetailViewProps) {
  const [servings, setServings] = useState(initialServings ?? dish.servings);
  const [showNutrition, setShowNutrition] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [completedStepIds, setCompletedStepIds] =
    useState<readonly string[]>(initialCompletedStepIds);
  const ganttRef = useRef<GanttChartHandle>(null);

  const recipe = dish.recipe;
  const scale = servings / dish.servings;
  const items = useMemo(
    () => buildIngredientItems(recipe, { scale, ingredientById }),
    [recipe, scale, ingredientById],
  );
  const groups = useMemo(() => buildIngredientGroups(recipe), [recipe]);
  const totals = useMemo(() => sumIngredientItems(items), [items]);

  // 工程表から選んだら手順の一覧へ移動する
  const selectFromGantt = useCallback((stepId: string) => {
    setActiveStepId(stepId);
    document
      .getElementById(`step-${stepId}`)
      ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }, []);
  // 手順の番号から選んだら工程表の該当行を表示する
  const selectFromSteps = useCallback((stepId: string) => {
    setActiveStepId(stepId);
    ganttRef.current?.scrollToStep(stepId);
  }, []);
  const toggleComplete = useCallback((stepId: string) => {
    setCompletedStepIds((current) =>
      current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId],
    );
  }, []);

  const completedCount = completedStepIds.length;
  const stepCount = recipe.steps.length;

  return (
    <Page>
      <PageHeader
        size="display"
        breadcrumbs={BREADCRUMBS}
        title={dish.name}
        meta={
          <HStack gap="2" wrap="wrap">
            {dish.category ? <Badge>{dish.category}</Badge> : null}
            <span>基準 {dish.servings}人前</span>
            {schedule.totalDurationSec > 0 ? (
              <>
                <MetaSeparator />
                <span>調理 {formatMinutes(schedule.totalDurationSec)}</span>
              </>
            ) : null}
          </HStack>
        }
        actions={
          <>
            <Button asChild variant="primary">
              <Link to="/" search={{ dishId: dish.id, servings }}>
                <Plus strokeWidth={1.75} />
                食事記録に追加
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dishes/new" search={{ dishId: dish.id }}>
                <Pencil strokeWidth={1.75} />
                編集
              </Link>
            </Button>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <IconButton variant="outline" aria-label="その他の操作">
                  <MoreHorizontal strokeWidth={1.75} />
                </IconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="edit-meta" onSelect={() => onEditMeta?.()}>
                      <Pencil strokeWidth={1.75} />
                      名前・カテゴリ・メモを編集
                    </Menu.Item>
                    <Menu.Separator />
                    <Menu.Item value="delete" onSelect={() => onDelete?.()}>
                      <Trash2 strokeWidth={1.75} />
                      削除
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </>
        }
      />

      {dish.coverImageId ? <RecipeCover imageId={dish.coverImageId} title={dish.name} /> : null}

      <Section title="工程" id="gantt">
        <GanttChart
          ref={ganttRef}
          schedule={schedule}
          steps={recipe.steps}
          activeStepId={activeStepId}
          completedStepIds={completedStepIds}
          onStepSelect={selectFromGantt}
        />
      </Section>

      <Grid
        templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 320px" }}
        columnGap="12"
        rowGap={{ base: "10", md: "12" }}
        alignItems="start"
      >
        <Stack gap={{ base: "10", md: "12" }} minW="0">
          <Section
            title="材料"
            id="ingredients"
            actions={
              <HStack gap="5" wrap="wrap">
                <ServingsStepper value={servings} onChange={setServings} />
                <Switch.Root
                  size="sm"
                  checked={showNutrition}
                  onCheckedChange={(details) => setShowNutrition(details.checked)}
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Label>栄養価</Switch.Label>
                </Switch.Root>
              </HStack>
            }
          >
            <IngredientList
              items={items}
              groups={groups}
              showNutrition={showNutrition}
              onStepSelect={selectFromGantt}
            />
          </Section>

          <Section
            title="手順"
            id="steps"
            meta={completedCount > 0 ? `${completedCount} / ${stepCount} 完了` : undefined}
            actions={
              completedCount > 0 ? (
                <Button variant="ghost" size="xs" onClick={() => setCompletedStepIds([])}>
                  リセット
                </Button>
              ) : undefined
            }
          >
            <StepList
              recipe={recipe}
              ingredientById={ingredientById}
              bars={schedule.bars}
              scale={scale}
              completedStepIds={completedStepIds}
              onToggleComplete={toggleComplete}
              activeStepId={activeStepId}
              onStepSelect={selectFromSteps}
            />
          </Section>
        </Stack>

        <Stack
          as="aside"
          aria-label="栄養価と補足"
          gap="10"
          minW="0"
          position={{ lg: "sticky" }}
          top={{ lg: "88px" }}
        >
          <Section title="栄養価・原価" headingLevel={3}>
            <NutritionSummary
              facts={totals.facts}
              costYen={totals.costYen}
              costMissingCount={totals.costMissingCount}
              servings={servings}
              layout="stack"
            />
          </Section>
          <RecipeNotes
            summary={recipe.summary}
            notes={dish.notes}
            equipment={recipe.equipment}
            cautions={recipe.globalCautions}
          />
        </Stack>
      </Grid>
    </Page>
  );
}

/** 読み込み中の骨組み。見出し・工程表・材料の位置を先に確保する。 */
export function DishDetailSkeleton() {
  return (
    <Page>
      <Stack gap="3" aria-busy="true" aria-label="レシピを読み込み中">
        <Skeleton h="4" w="24" />
        <Skeleton h="10" w={{ base: "70%", md: "40%" }} />
        <Skeleton h="4" w="48" />
      </Stack>
      <Box>
        <Skeleton h="7" w="16" mb="3" />
        <Skeleton h="320px" />
      </Box>
      <Stack gap="3" maxW={{ lg: "calc(100% - 368px)" }}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} h="10" />
        ))}
      </Stack>
    </Page>
  );
}
