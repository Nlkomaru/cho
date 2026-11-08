import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";

import { Numeric } from "../../../components/ui/numeric";
import { journal } from "../../../../theme/slot-recipes/journal";
import { currency, localTimeValue, sourceName, type Meal } from "./meal-shared";
import { NutritionLine } from "./nutrition-line";

export interface MealEntryProps {
  meal: Meal;
}

export function MealEntry({ meal }: MealEntryProps) {
  const recipe = useSlotRecipe({ recipe: journal });
  const styles = recipe();
  const imageId = meal.imageIds[0];

  return (
    <Box as="li" css={styles.entry}>
      <Box css={styles.time}>
        <Numeric size="sm" tone="muted">
          {localTimeValue(meal.eatenAt)}
        </Numeric>
      </Box>
      <Box css={styles.body}>
        <Box css={styles.head}>
          {imageId ? (
            <chakra.img
              src={`/api/images/${encodeURIComponent(imageId)}`}
              alt={`${meal.title}の写真`}
              css={styles.thumb}
            />
          ) : null}
          <Box css={styles.text}>
            <Box css={styles.title}>
              <Link to="/meals/$mealId" params={{ mealId: meal.id }}>
                {meal.title}
              </Link>
            </Box>
            <Box css={styles.meta}>
              {sourceName[meal.sourceType]}
              {meal.placeName ? ` · ${meal.placeName}` : ""}
            </Box>
          </Box>
        </Box>
        <Box css={styles.values}>
          <Box css={styles.valueGroup}>
            <Box as="span">料金</Box>
            <Numeric size="sm" tone="strong">
              {currency(meal.totalPriceYen)}
            </Numeric>
          </Box>
          <NutritionLine nutrition={meal.totalNutrition} />
        </Box>
      </Box>
    </Box>
  );
}
