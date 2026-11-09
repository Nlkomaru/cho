import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { statGroupSlotRecipe } from "../../../theme/slot-recipes/stat-group";

export interface StatItem {
  label: string;
  value: ReactNode;
  /** 値の右に小さく添える単位 ("kcal" など)。 */
  unit?: string;
  /** 値の下の補足 ("1人前 ¥310" など)。 */
  note?: ReactNode;
}

export interface StatGroupProps {
  items: readonly StatItem[];
  /** `<dl>` の aria-label。 */
  label: string;
  size?: "md" | "sm";
  columns?: { base?: number; md?: number; lg?: number };
}

/**
 * 数値サマリー。箱で囲まず、各項目の上に細罫を引いて並べる。
 */
export function StatGroup({ items, label, size = "md", columns }: StatGroupProps) {
  const recipe = useSlotRecipe({ recipe: statGroupSlotRecipe });
  const styles = recipe({ size });
  const cols = { base: 2, md: 4, lg: 4, ...columns };

  return (
    <chakra.dl
      aria-label={label}
      css={styles.root}
      gridTemplateColumns={{
        base: `repeat(${cols.base}, minmax(0, 1fr))`,
        md: `repeat(${cols.md}, minmax(0, 1fr))`,
        lg: `repeat(${cols.lg}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const single =
          typeof item.value === "string" || typeof item.value === "number" || item.unit != null;
        return (
          <Box key={item.label} css={styles.item}>
            <chakra.dt css={styles.label}>{item.label}</chakra.dt>
            {/* 複数の数値 (PFC など) は一段小さくし、広い画面では 1 行に収める */}
            <chakra.dd css={styles.value} data-multi={single ? undefined : ""}>
              {single ? (
                <chakra.span whiteSpace="nowrap">
                  {item.value}
                  {item.unit ? <chakra.span css={styles.unit}>{item.unit}</chakra.span> : null}
                </chakra.span>
              ) : (
                item.value
              )}
            </chakra.dd>
            {item.note ? <chakra.dd css={styles.note}>{item.note}</chakra.dd> : null}
          </Box>
        );
      })}
    </chakra.dl>
  );
}

export interface StatPartProps {
  label: string;
  value: ReactNode;
  unit?: string;
}

/**
 * 1 つの値の中に複数の数値を並べるときの塊 (PFC の "P 22.2 g" など)。
 * 塊の間では折り返すが、塊の中では折り返さない。
 */
export function StatPart({ label, value, unit }: StatPartProps) {
  return (
    <chakra.span whiteSpace="nowrap" display="inline-flex" alignItems="baseline" gap="1">
      <chakra.span
        fontSize="14px"
        lineHeight="22px"
        color="fg.subtle"
        fontWeight="500"
        letterSpacing="0"
      >
        {label}
      </chakra.span>
      {value}
      {unit ? (
        <chakra.span
          fontSize="14px"
          lineHeight="22px"
          color="fg.subtle"
          fontWeight="400"
          letterSpacing="0"
        >
          {unit}
        </chakra.span>
      ) : null}
    </chakra.span>
  );
}
