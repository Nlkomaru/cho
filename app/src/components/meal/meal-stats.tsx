import { chakra } from "@chakra-ui/react";

import { StatGroup, StatPart } from "@/components/ui/stat-group";
import { formatFixed, formatNumber, formatYen } from "@/lib/format";

import type { MealTotals } from "./meal-shared";

export interface MealStatsProps {
  totals: MealTotals | null;
  /** `<dl>` の aria-label。 */
  label: string;
}

/** 値が無いときの短い注記。数値より小さく、薄く出す。 */
const mutedValue = {
  fontSize: "16px",
  color: "fg.muted",
  fontWeight: "400",
  letterSpacing: "0",
} as const;

const grams = (value: number | null | undefined) => (value == null ? undefined : "g");

/**
 * 料金・エネルギー・PFC・食物繊維と食塩の 4 項目。期間の集計と 1 食の合計で共用する。
 */
export function MealStats({ totals, label }: MealStatsProps) {
  const kcal = totals?.caloriesKcal;
  // 一部の記録だけ栄養価が無いときは、合計から外した件数を添える
  const missingNote =
    totals && kcal != null && totals.nutritionMissing > 0
      ? `栄養価なし ${totals.nutritionMissing}件を除く`
      : undefined;

  return (
    <StatGroup
      label={label}
      items={[
        totals?.priceYen != null
          ? { label: "料金", value: formatYen(totals.priceYen) }
          : { label: "料金", value: <chakra.span css={mutedValue}>料金なし</chakra.span> },
        {
          label: "エネルギー",
          value: formatNumber(kcal, 0),
          unit: kcal == null ? undefined : "kcal",
          note: missingNote,
        },
        {
          label: "PFC",
          value: (
            <>
              <StatPart
                label="P"
                value={formatFixed(totals?.proteinG)}
                unit={grams(totals?.proteinG)}
              />
              <StatPart label="F" value={formatFixed(totals?.fatG)} unit={grams(totals?.fatG)} />
              <StatPart
                label="C"
                value={formatFixed(totals?.carbohydrateG)}
                unit={grams(totals?.carbohydrateG)}
              />
            </>
          ),
        },
        {
          label: "食物繊維・食塩",
          value: (
            <>
              <StatPart
                label="繊維"
                value={formatFixed(totals?.fiberG)}
                unit={grams(totals?.fiberG)}
              />
              <StatPart
                label="塩"
                value={formatFixed(totals?.saltEquivalentG)}
                unit={grams(totals?.saltEquivalentG)}
              />
            </>
          ),
        },
      ]}
    />
  );
}
