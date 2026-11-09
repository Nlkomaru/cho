import { Box, Flex, chakra } from "@chakra-ui/react";

import { formatNumber, formatYen } from "@/lib/format";

import type { MealItem } from "./meal-shared";

export interface MealCostListProps {
  items: readonly MealItem[];
}

/** 材料原価の内訳を持つ品目があるか。無ければ原価の欄ごと出さない。 */
export const hasCostBreakdown = (items: readonly MealItem[]) =>
  items.some((item) => item.ingredientCostBreakdown?.length);

/**
 * レシピ・材料から記録した品目の材料原価。材料ごとに分量と金額を右揃えで並べ、最後に合計。
 */
export function MealCostList({ items }: MealCostListProps) {
  const withCosts = items.filter((item) => item.ingredientCostBreakdown?.length);
  const showItemNames = withCosts.length > 1;
  const total = withCosts.reduce(
    (sum, item) =>
      sum + (item.ingredientCostBreakdown ?? []).reduce((acc, cost) => acc + cost.costYen, 0),
    0,
  );

  if (withCosts.length === 0) {
    return (
      <chakra.p textStyle="body.sm" color="fg.muted">
        材料原価の内訳はありません
      </chakra.p>
    );
  }

  return (
    <Box>
      {withCosts.map((item, itemIndex) => (
        <Box key={item.id ?? itemIndex}>
          {showItemNames ? (
            <chakra.h3
              textStyle="heading.group"
              color="fg.strong"
              pt={itemIndex ? "4" : "0"}
              pb="1"
            >
              {item.name}
            </chakra.h3>
          ) : null}
          <chakra.ul listStyle="none" m="0" p="0">
            {(item.ingredientCostBreakdown ?? []).map((cost, index) => (
              <Flex
                as="li"
                key={`${cost.ingredientId}-${index}`}
                justify="space-between"
                align="baseline"
                gap="3"
                py="2"
                borderBottomWidth="1px"
                borderColor="border"
                textStyle="body.sm"
              >
                <Box minW="0">
                  <chakra.span color="fg">{cost.name}</chakra.span>
                  <chakra.span
                    color="fg.subtle"
                    textStyle="caption"
                    ms="2"
                    fontVariantNumeric="tabular-nums"
                    whiteSpace="nowrap"
                  >
                    {formatNumber(cost.amount)} {cost.unit}
                  </chakra.span>
                </Box>
                <chakra.span
                  color="fg.strong"
                  fontVariantNumeric="tabular-nums"
                  whiteSpace="nowrap"
                >
                  {formatYen(cost.costYen)}
                </chakra.span>
              </Flex>
            ))}
          </chakra.ul>
        </Box>
      ))}
      <Flex justify="space-between" align="baseline" pt="3" textStyle="body.sm">
        <chakra.span color="fg.muted" fontWeight="500">
          合計
        </chakra.span>
        <chakra.span
          color="fg.strong"
          fontWeight="600"
          fontVariantNumeric="tabular-nums"
          fontSize="16px"
        >
          {formatYen(total)}
        </chakra.span>
      </Flex>
    </Box>
  );
}
