import { Box, chakra, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { page } from "../../../theme/recipes/page";
import { pageHeader } from "../../../theme/slot-recipes/page-header";

export interface PageProps {
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/**
 * 画面本体のコンテナ。余白・最大幅はレシピ側で決める。
 */
export function Page({ size = "md", children }: PageProps) {
  const recipe = useRecipe({ recipe: page });

  return (
    <Box as="main" css={recipe({ size })}>
      {children}
    </Box>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
}

/**
 * ページヘッダー。タイトルとアクションのみを左右に置く
 * (spec/02_design-system.md §4.1)。説明文用のスロットは持たない。
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  const recipe = useSlotRecipe({ recipe: pageHeader });
  const styles = recipe();

  return (
    <Box as="header" css={styles.root}>
      <chakra.h1 css={styles.title}>{title}</chakra.h1>
      {actions ? <Box css={styles.actions}>{actions}</Box> : null}
    </Box>
  );
}
