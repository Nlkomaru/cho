import { Box, Grid, Skeleton, Stack, chakra } from "@chakra-ui/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment } from "react";

import { MetaSeparator, PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { formatDateJa, formatTime } from "@/lib/format";

import { hasCostBreakdown, MealCostList } from "./meal-cost-list";
import { MealItemsTable } from "./meal-items-table";
import { MealPhotoGallery } from "./meal-photo-gallery";
import { mealMetaParts, summarizeMeals, type Meal } from "./meal-shared";
import { MealStats } from "./meal-stats";
import { MealStockPanel } from "./meal-stock-panel";

export interface MealDetailViewProps {
  meal: Meal;
  onEdit?(): void;
  onDelete?(): void;
  stockWorking?: boolean;
  stockError?: string;
  onConsumeStock?(): void;
  /** 画像 ID から表示 URL を作る (ストーリー用)。 */
  resolveImageSrc?(id: string): string;
}

/**
 * 食事詳細ページの本体 (データ取得なし)。見出し → 写真 → 合計 → 品目と原価・在庫。
 * 合計の料金は記録の料金 (空欄で保存すれば品目の料金の合計)。材料原価はレシピの品目の内訳。
 */
export function MealDetailView({
  meal,
  onEdit,
  onDelete,
  stockWorking,
  stockError,
  onConsumeStock,
  resolveImageSrc,
}: MealDetailViewProps) {
  const metaParts = mealMetaParts(meal);

  return (
    <>
      <Stack gap="5">
        <PageHeader
          size="display"
          breadcrumbs={[{ label: "食事記録", to: "/" }]}
          title={meal.title}
          meta={
            <>
              <chakra.time dateTime={meal.eatenAt} fontVariantNumeric="tabular-nums">
                {formatDateJa(meal.eatenAt)} {formatTime(meal.eatenAt)}
              </chakra.time>
              {metaParts.map((part) => (
                <Fragment key={part}>
                  <MetaSeparator />
                  <span>{part}</span>
                </Fragment>
              ))}
            </>
          }
          actions={
            <>
              {onEdit ? (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Pencil strokeWidth={1.75} />
                  編集
                </Button>
              ) : null}
              {onDelete ? (
                <Button variant="danger" size="sm" onClick={onDelete}>
                  <Trash2 strokeWidth={1.75} />
                  削除
                </Button>
              ) : null}
            </>
          }
        />
        {meal.memo ? (
          <chakra.p textStyle="body.lg" color="fg" maxW="prose" whiteSpace="pre-wrap">
            {meal.memo}
          </chakra.p>
        ) : null}
      </Stack>

      {meal.imageIds.length ? (
        <MealPhotoGallery
          imageIds={meal.imageIds}
          title={meal.title}
          resolveSrc={resolveImageSrc}
        />
      ) : null}

      <MealStats label="この食事の合計" totals={summarizeMeals([meal])} />

      <Grid
        templateColumns={{ base: "minmax(0, 1fr)", lg: "repeat(12, minmax(0, 1fr))" }}
        columnGap="10"
        rowGap={{ base: "10", md: "12" }}
        alignItems="start"
      >
        <Box gridColumn={{ lg: "span 8" }} minW="0">
          <Section
            title="品目"
            meta={`${meal.items.length}品`}
            actions={
              onEdit ? (
                // レシピ・材料・AI解析からの追加は編集ドロワーで行う
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Plus strokeWidth={1.75} />
                  品目を追加
                </Button>
              ) : null
            }
          >
            <MealItemsTable items={meal.items} />
          </Section>
        </Box>
        <Stack gridColumn={{ lg: "span 4" }} gap={{ base: "10", md: "12" }} minW="0">
          {hasCostBreakdown(meal.items) ? (
            <Section title="レシピの材料原価">
              <MealCostList items={meal.items} />
            </Section>
          ) : null}
          <Section title="在庫消費">
            <MealStockPanel
              status={meal.inventiaConsumptionStatus}
              selfCooked={meal.sourceType === "self_cooked"}
              working={stockWorking}
              error={stockError}
              onConsume={onConsumeStock}
            />
          </Section>
        </Stack>
      </Grid>
    </>
  );
}

/** 読み込み中の仮表示。 */
export function MealDetailSkeleton() {
  return (
    <Stack role="status" aria-busy="true" aria-label="読み込み中" gap={{ base: "10", md: "12" }}>
      <Stack gap="3">
        <Skeleton h="4" w="24" />
        <Skeleton h={{ base: "9", md: "11" }} w="60%" />
        <Skeleton h="4" w="40%" />
      </Stack>
      <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap="6">
        {Array.from({ length: 4 }, (_, index) => (
          <Stack key={index} gap="2" pt="4" borderTopWidth="1px" borderColor="border">
            <Skeleton h="3" w="16" />
            <Skeleton h="7" w="24" />
          </Stack>
        ))}
      </Grid>
    </Stack>
  );
}
