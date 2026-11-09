import { Box, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { pageSlotRecipe } from "../../../theme/slot-recipes/page";

export interface PageProps {
  /** lg: 一覧・詳細 (既定)、md: フォーム・設定、sm: 狭い読み物。 */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/**
 * 画面本体のコンテナ。余白・最大幅・セクション間の間隔を決める。
 * `<main>` は AppShell が持つので、ここでは div にする。
 */
export function Page({ size = "lg", children }: PageProps) {
  const recipe = useSlotRecipe({ recipe: pageSlotRecipe });
  const styles = recipe({ size });

  return <Box css={styles.root}>{children}</Box>;
}
