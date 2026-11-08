import { Box, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { card } from "../../../theme/slot-recipes/card";

export interface CardProps {
  as?: "div" | "article" | "li";
  media?: ReactNode;
  title?: ReactNode;
  titleAs?: "h2" | "h3";
  meta?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * 白背景 + 1px 罫線 + 角丸 `l3` のカード。影・グラデーションは使わない。
 */
export function Card({
  as = "div",
  media,
  title,
  titleAs = "h2",
  meta,
  footer,
  children,
}: CardProps) {
  const recipe = useSlotRecipe({ recipe: card });
  const styles = recipe();
  const Title = titleAs === "h3" ? "h3" : "h2";

  return (
    <Box as={as} css={styles.root}>
      {media ? <Box css={styles.media}>{media}</Box> : null}
      {title || meta ? (
        <Box css={styles.header}>
          {title ? (
            <Box as={Title} css={styles.title}>
              {title}
            </Box>
          ) : null}
          {meta ? <Box css={styles.meta}>{meta}</Box> : null}
        </Box>
      ) : null}
      {children ? <Box css={styles.body}>{children}</Box> : null}
      {footer ? <Box css={styles.footer}>{footer}</Box> : null}
    </Box>
  );
}
