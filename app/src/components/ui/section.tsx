import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { section } from "../../../theme/slot-recipes/section";

export interface SectionProps {
  title?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3;
  divided?: boolean;
  label?: string;
  children: ReactNode;
}

/**
 * 画面上の区切りセクション。上罫線と見出しを共通化する。
 */
export function Section({
  title,
  actions,
  level = 2,
  divided = true,
  label,
  children,
}: SectionProps) {
  const recipe = useSlotRecipe({ recipe: section });
  const styles = recipe({ divided, level });
  const Heading = level === 3 ? chakra.h3 : chakra.h2;

  return (
    <Box as="section" aria-label={label} css={styles.root}>
      {title || actions ? (
        <Box css={styles.header}>
          {title ? <Heading css={styles.title}>{title}</Heading> : null}
          {actions ? <Box css={styles.actions}>{actions}</Box> : null}
        </Box>
      ) : null}
      <Box css={styles.body}>{children}</Box>
    </Box>
  );
}
