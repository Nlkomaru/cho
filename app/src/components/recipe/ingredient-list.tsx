import { Box, Stack, chakra } from "@chakra-ui/react";
import { Fragment } from "react";

import { NutritionInline } from "@/components/food/nutrition-inline";
import { SubHeading } from "@/components/layout/section";
import type { NutritionFacts } from "@/domain/nutrition";

export interface IngredientListUsage {
  stepId: string;
  stepNumber: number;
  /** 換算済みの表示分量。 */
  amount: string;
}

export interface IngredientListItem {
  id: string;
  name: string;
  /** 換算済みの表示分量 ("300g"、"大さじ1")。 */
  amount: string;
  /** 下ごしらえ。 */
  prep?: string | null;
  /** 所属する材料グループの key。 */
  groupKey?: string | null;
  usages: readonly IngredientListUsage[];
  facts?: NutritionFacts | null;
  costYen?: number | null;
}

export interface IngredientListGroup {
  key: string;
  /** 記号 + 名前 ("★ 隠し味")。 */
  label: string;
}

export interface IngredientListProps {
  items: readonly IngredientListItem[];
  groups?: readonly IngredientListGroup[];
  /** 各行の 2 行目に栄養価と原価を出す。 */
  showNutrition?: boolean;
  /** 手順番号を押したとき。 */
  onStepSelect?(stepId: string): void;
  /** 2: lg 以上で 2 列に並べる。 */
  columns?: 1 | 2;
}

/**
 * 材料表。グループなしの材料を先に、続けてグループごとに小見出しを付けて並べる。
 * 複数の手順で使う材料だけ、分量の下に手順番号を出す。
 */
export function IngredientList({
  items,
  groups = [],
  showNutrition = false,
  onStepSelect,
  columns = 1,
}: IngredientListProps) {
  const knownGroups = new Set(groups.map((group) => group.key));
  const ungrouped = items.filter((item) => !item.groupKey || !knownGroups.has(item.groupKey));
  const sections = [
    { key: "__ungrouped", label: null as string | null, items: ungrouped },
    ...groups.map((group) => ({
      key: group.key,
      label: group.label,
      items: items.filter((item) => item.groupKey === group.key),
    })),
  ].filter((section) => section.items.length > 0);

  return (
    <Stack gap="6">
      {sections.map((section) => (
        <Stack key={section.key} gap="1">
          {section.label ? (
            <Box pb="1">
              <SubHeading as="h3" trailing={`${section.items.length}品`}>
                {section.label}
              </SubHeading>
            </Box>
          ) : null}
          <chakra.ul
            listStyle="none"
            m="0"
            p="0"
            display="grid"
            gridTemplateColumns={columns === 2 ? { base: "1fr", lg: "1fr 1fr" } : "1fr"}
            columnGap="10"
            aria-label={section.label ?? "材料"}
          >
            {section.items.map((item) => (
              <IngredientRow
                key={item.id}
                item={item}
                showNutrition={showNutrition}
                onStepSelect={onStepSelect}
              />
            ))}
          </chakra.ul>
        </Stack>
      ))}
    </Stack>
  );
}

function IngredientRow({
  item,
  showNutrition,
  onStepSelect,
}: {
  item: IngredientListItem;
  showNutrition: boolean;
  onStepSelect?(stepId: string): void;
}) {
  const multiStep = item.usages.length > 1;
  const costMissing = item.costYen === null;
  return (
    <chakra.li
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      columnGap="4"
      rowGap="1"
      alignItems="baseline"
      minH="12"
      py="3"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Box minW="0">
        <chakra.span fontSize="15px" lineHeight="22px" color="fg.strong">
          {item.name}
        </chakra.span>
        {item.prep ? (
          <chakra.span textStyle="caption" color="fg.subtle" ms="2">
            {item.prep}
          </chakra.span>
        ) : null}
        {costMissing && !showNutrition ? (
          <chakra.span textStyle="caption" color="fg.subtle" ms="2">
            単価未登録
          </chakra.span>
        ) : null}
      </Box>
      <chakra.span
        fontSize="15px"
        lineHeight="22px"
        fontWeight="500"
        color="fg.strong"
        fontVariantNumeric="tabular-nums"
        textAlign="end"
        whiteSpace="nowrap"
      >
        {item.amount}
      </chakra.span>
      {showNutrition ? (
        <Box minW="0" gridColumn={multiStep ? "1" : "1 / -1"}>
          <NutritionInline
            facts={item.facts ?? null}
            costYen={item.costYen}
            costMissing={costMissing}
            size="xs"
          />
        </Box>
      ) : null}
      {multiStep ? (
        <Box
          gridColumn="2"
          textAlign="end"
          fontSize="13px"
          lineHeight="18px"
          color="fg.muted"
          display="flex"
          flexWrap="wrap"
          justifyContent="end"
          columnGap="1.5"
        >
          {item.usages.map((usage, index) => (
            <Fragment key={`${usage.stepId}-${index}`}>
              {index > 0 ? (
                <chakra.span aria-hidden="true" color="fg.subtle">
                  ·
                </chakra.span>
              ) : null}
              <chakra.button
                type="button"
                color="inherit"
                whiteSpace="nowrap"
                fontVariantNumeric="tabular-nums"
                cursor="pointer"
                borderRadius="l1"
                _hover={{
                  color: "red.600",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
                onClick={() => onStepSelect?.(usage.stepId)}
                aria-label={`手順${usage.stepNumber}で${usage.amount}`}
              >
                手順{usage.stepNumber}
                <chakra.span color="fg.subtle" ms="1">
                  {usage.amount}
                </chakra.span>
              </chakra.button>
            </Fragment>
          ))}
        </Box>
      ) : null}
    </chakra.li>
  );
}
