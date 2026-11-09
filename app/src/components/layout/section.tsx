import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { type ReactNode, useId } from "react";

import { sectionSlotRecipe } from "../../../theme/slot-recipes/section";

export interface SectionProps {
  /** 見える見出し (h2 / h3)。省略する場合は `label` を渡す。 */
  title?: ReactNode;
  /** 見出しが無いときの aria-label。 */
  label?: string;
  /** 見出し行の右側 (切り替え・小さなボタンなど)。 */
  actions?: ReactNode;
  /** 見出しの直後に置く補足 ("52:00"、"12件" など)。 */
  meta?: ReactNode;
  /** rule: 見出し下に 2px の紺の罫。plain: 罫なし。 */
  variant?: "rule" | "plain";
  headingLevel?: 2 | 3;
  id?: string;
  children: ReactNode;
}

/**
 * 画面の区切り。見出し行 → 罫 → 本文の順に並べる。
 */
export function Section({
  title,
  label,
  actions,
  meta,
  variant = "rule",
  headingLevel = 2,
  id,
  children,
}: SectionProps) {
  const recipe = useSlotRecipe({ recipe: sectionSlotRecipe });
  const styles = recipe({ variant, level: headingLevel === 3 ? "h3" : "h2" });
  const headingId = useId();
  const Heading = headingLevel === 3 ? chakra.h3 : chakra.h2;
  const hasHeader = Boolean(title || actions || meta);

  return (
    <Box
      as="section"
      id={id}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
      css={styles.root}
    >
      {hasHeader ? (
        <Box css={styles.header}>
          <Box css={styles.titleGroup}>
            {title ? (
              <Heading id={headingId} css={styles.title}>
                {title}
              </Heading>
            ) : null}
            {meta ? <Box css={styles.meta}>{meta}</Box> : null}
          </Box>
          {actions ? <Box css={styles.actions}>{actions}</Box> : null}
        </Box>
      ) : null}
      <Box css={hasHeader ? styles.body : undefined}>{children}</Box>
    </Box>
  );
}

export interface SubHeadingProps {
  children: ReactNode;
  /** 罫線の右端に置く補足 (件数など)。 */
  trailing?: ReactNode;
  as?: "h3" | "h4" | "p";
}

/**
 * 小見出し + 右へ伸びる細罫 (AISI の "Blogs: ———")。材料グループやレーンの見出しに使う。
 */
export function SubHeading({ children, trailing, as = "h3" }: SubHeadingProps) {
  const recipe = useSlotRecipe({ recipe: sectionSlotRecipe });
  const styles = recipe();

  return (
    <Box css={styles.subHeading}>
      <Box as={as} css={styles.subTitle}>
        {children}
      </Box>
      <Box aria-hidden="true" css={styles.subRule} />
      {trailing ? (
        <Box textStyle="caption" color="fg.subtle" flexShrink={0}>
          {trailing}
        </Box>
      ) : null}
    </Box>
  );
}
