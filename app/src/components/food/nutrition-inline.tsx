import { chakra } from "@chakra-ui/react";
import { Fragment } from "react";

import type { NutritionFacts } from "@/domain/nutrition";
import { formatNumber, formatYen } from "@/lib/format";

export interface NutritionInlineProps {
  facts: NutritionFacts | null;
  costYen?: number | null;
  /** 単価が無い材料。原価の代わりに「単価未登録」を薄く出す。 */
  costMissing?: boolean;
  size?: "sm" | "xs";
}

/**
 * 1 行の栄養価 "677 kcal · P 22.2 · F 24.8 · C 96.3"。数値は fg、単位とラベルは fg.subtle。
 */
export function NutritionInline({
  facts,
  costYen,
  costMissing = false,
  size = "sm",
}: NutritionInlineProps) {
  const parts: { key: string; label?: string; value: string; unit?: string }[] = [];
  if (costYen !== undefined && costYen !== null) {
    parts.push({ key: "cost", value: formatYen(costYen) });
  } else if (costMissing) {
    parts.push({ key: "cost", value: "単価未登録" });
  }
  if (facts) {
    parts.push(
      { key: "kcal", value: formatNumber(facts.caloriesKcal, 0), unit: "kcal" },
      { key: "p", label: "P", value: formatNumber(facts.proteinG) },
      { key: "f", label: "F", value: formatNumber(facts.fatG) },
      { key: "c", label: "C", value: formatNumber(facts.carbohydrateG) },
    );
  }

  if (parts.length === 0) {
    return (
      <chakra.span textStyle={size === "xs" ? "caption" : "body.sm"} color="fg.subtle">
        栄養価なし
      </chakra.span>
    );
  }

  return (
    <chakra.span
      textStyle={size === "xs" ? "caption" : "body.sm"}
      color="fg"
      fontVariantNumeric="tabular-nums"
      display="inline-flex"
      flexWrap="wrap"
      columnGap="1.5"
      rowGap="0"
    >
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 ? (
            <chakra.span aria-hidden="true" color="fg.subtle">
              ·
            </chakra.span>
          ) : null}
          <chakra.span whiteSpace="nowrap">
            {part.label ? (
              <chakra.span color="fg.subtle" me="0.5">
                {part.label}
              </chakra.span>
            ) : null}
            {part.value}
            {part.unit ? (
              <chakra.span color="fg.subtle" ms="0.5">
                {part.unit}
              </chakra.span>
            ) : null}
          </chakra.span>
        </Fragment>
      ))}
    </chakra.span>
  );
}
