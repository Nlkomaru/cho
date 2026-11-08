import { Box, useSlotRecipe } from "@chakra-ui/react";

import { Numeric } from "../../../components/ui/numeric";
import { journal } from "../../../../theme/slot-recipes/journal";
import { currency, fmt, groupMealsByDay, type Meal } from "./meal-shared";
import { MealEntry } from "./meal-entry";

export interface MealJournalProps {
  meals: readonly Meal[];
}

/**
 * カレンダー日ごとにまとめる食事ジャーナル。日計は日付ヘッダーに置く。
 */
export function MealJournal({ meals }: MealJournalProps) {
  const recipe = useSlotRecipe({ recipe: journal });
  const styles = recipe();
  const groups = groupMealsByDay(meals);

  return (
    <Box css={styles.root}>
      {groups.map((group) => (
        <Box as="section" key={group.key} aria-label={`${group.label}の食事`} css={styles.day}>
          <Box css={styles.dayHeader}>
            <Box css={styles.dayTitle}>{group.label}</Box>
            <Box css={styles.dayTotals}>
              <Box css={styles.valueGroup}>
                <Box as="span">日計</Box>
                <Numeric size="sm" tone="muted">
                  {currency(group.priceYen)}
                </Numeric>
              </Box>
              {group.hasNutrition ? (
                <Box css={styles.valueGroup}>
                  <Numeric size="sm" tone="muted">
                    {fmt(group.caloriesKcal)}
                  </Numeric>
                  <Box as="span">kcal</Box>
                </Box>
              ) : null}
            </Box>
          </Box>
          <Box as="ul" css={styles.entries}>
            {group.meals.map((meal) => (
              <MealEntry key={meal.id} meal={meal} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
