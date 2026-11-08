import { Box, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { statBar } from "../../../theme/slot-recipes/stat-bar";

export interface StatItem {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}

export interface StatBarProps {
  items: readonly StatItem[];
  label?: string;
}

/**
 * 数値サマリーの帯。値は等幅数字 (tabular-nums) で桁を揃える。
 */
export function StatBar({ items, label }: StatBarProps) {
  const recipe = useSlotRecipe({ recipe: statBar });
  const styles = recipe();

  return (
    <Box as="section" aria-label={label} css={styles.root}>
      {items.map((item, index) => (
        <Box key={index} css={styles.item}>
          <Box css={styles.label}>{item.label}</Box>
          <Box css={styles.value}>{item.value}</Box>
          {item.note ? <Box css={styles.note}>{item.note}</Box> : null}
        </Box>
      ))}
    </Box>
  );
}
