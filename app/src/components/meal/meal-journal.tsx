import { Box, Skeleton, chakra, useSlotRecipe } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";

import { NutritionInline } from "@/components/food/nutrition-inline";
import { formatDateJa, formatNumber, formatTime, formatYen } from "@/lib/format";

import { mealJournalRecipe } from "./meal-journal.recipe";
import { imageUrl, mealMetaParts, type Meal, type MealDay } from "./meal-shared";

export interface MealJournalProps {
  days: readonly MealDay[];
}

/**
 * 日付ごとにまとめた食事の一覧。日付の見出しに日計を置き、行全体が詳細へのリンクになる。
 */
export function MealJournal({ days }: MealJournalProps) {
  const recipe = useSlotRecipe({ recipe: mealJournalRecipe });
  const styles = recipe();

  return (
    <Box css={styles.root}>
      {days.map((day) => {
        const headingId = `meal-day-${day.key}`;
        return (
          <Box as="section" key={day.key} aria-labelledby={headingId} css={styles.day}>
            <Box css={styles.dayHeader}>
              <chakra.h2 id={headingId} css={styles.dayTitle}>
                {formatDateJa(day.date)}
              </chakra.h2>
              <Box css={styles.dayTotals}>
                {day.priceYen != null ? <span>{formatYen(day.priceYen)}</span> : null}
                {day.priceYen != null && day.caloriesKcal !== null ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                {day.caloriesKcal !== null ? (
                  <span>{formatNumber(day.caloriesKcal, 0)} kcal</span>
                ) : null}
              </Box>
            </Box>
            <Box as="ul" css={styles.entries}>
              {day.meals.map((meal) => (
                <MealEntryRow key={meal.id} meal={meal} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export interface MealEntryRowProps {
  meal: Meal;
}

/** ジャーナルの 1 行。時刻・写真・料理名・区分・料金と栄養価。 */
export function MealEntryRow({ meal }: MealEntryRowProps) {
  const recipe = useSlotRecipe({ recipe: mealJournalRecipe });
  const styles = recipe();
  const imageId = meal.imageIds[0];

  return (
    <Box as="li" className="group" css={styles.entry}>
      <chakra.time dateTime={meal.eatenAt} css={styles.time}>
        {formatTime(meal.eatenAt)}
      </chakra.time>
      <Box css={styles.thumb}>
        {imageId ? (
          <img src={imageUrl(imageId)} alt="" loading="lazy" />
        ) : (
          <UtensilsCrossed size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </Box>
      <Box css={styles.main}>
        <Box css={styles.title}>
          <Link to="/meals/$mealId" params={{ mealId: meal.id }}>
            {meal.title}
          </Link>
        </Box>
        <Box css={styles.meta}>{mealMetaParts(meal).join(" · ")}</Box>
      </Box>
      <Box css={styles.values}>
        {/* 料金が無い食事は "—" を並べず、栄養価だけを出す */}
        {meal.totalPriceYen != null ? (
          <Box as="span" css={styles.price}>
            {formatYen(meal.totalPriceYen)}
          </Box>
        ) : null}
        <NutritionInline facts={meal.totalNutrition} size="xs" />
      </Box>
    </Box>
  );
}

/** 読み込み中の仮表示。 */
export function MealJournalSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Box role="status" aria-busy="true" aria-label="読み込み中">
      <Skeleton h="6" w="40" mb="3" />
      <Box borderTopWidth="2px" borderColor="border.strong">
        {Array.from({ length: rows }, (_, index) => (
          <Box
            key={index}
            display="flex"
            gap="4"
            alignItems="center"
            py="4"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Skeleton boxSize={{ base: "48px", md: "56px" }} flexShrink="0" />
            <Box flex="1">
              <Skeleton h="4" w="50%" mb="2" />
              <Skeleton h="3" w="30%" />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
