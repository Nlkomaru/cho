import { Box, Breadcrumb as ChakraBreadcrumb, chakra, useSlotRecipe } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { Breadcrumb } from "@/lib/breadcrumbs";

import { pageSlotRecipe } from "../../../theme/slot-recipes/page";

export interface PageHeaderProps {
  title: ReactNode;
  /** 祖先へのパンくず。現在地 (title) は含めない。リンク 1 段だけなら「← 親」の戻るリンクになる。 */
  breadcrumbs?: readonly Breadcrumb[];
  /** タイトル下の 1 行。タグや "·" 区切りの事実を並べる。 */
  meta?: ReactNode;
  /** 右寄せの操作。狭い画面ではタイトルの下に折り返す。 */
  actions?: ReactNode;
  /** page: 一覧画面、display: 詳細画面の大きな見出し。 */
  size?: "page" | "display";
}

export function PageHeader({ title, breadcrumbs, meta, actions, size = "page" }: PageHeaderProps) {
  const recipe = useSlotRecipe({ recipe: pageSlotRecipe });
  const styles = recipe({ titleSize: size });

  const parent = breadcrumbs?.length === 1 ? breadcrumbs[0] : undefined;

  return (
    <Box as="header" css={styles.header}>
      {parent?.to ? (
        <chakra.a asChild css={styles.back}>
          <Link to={parent.to} activeOptions={{ exact: true }}>
            <ArrowLeft strokeWidth={1.75} aria-hidden="true" />
            {parent.label}
          </Link>
        </chakra.a>
      ) : breadcrumbs && breadcrumbs.length > 0 ? (
        <ChakraBreadcrumb.Root aria-label="パンくずリスト" size="sm">
          <ChakraBreadcrumb.List>
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                <ChakraBreadcrumb.Item>
                  {crumb.to ? (
                    <ChakraBreadcrumb.Link asChild>
                      <Link to={crumb.to} activeOptions={{ exact: true }}>
                        {crumb.label}
                      </Link>
                    </ChakraBreadcrumb.Link>
                  ) : (
                    <chakra.span>{crumb.label}</chakra.span>
                  )}
                </ChakraBreadcrumb.Item>
                {index < breadcrumbs.length - 1 ? (
                  <ChakraBreadcrumb.Separator>
                    <ChevronRight strokeWidth={1.75} />
                  </ChakraBreadcrumb.Separator>
                ) : null}
              </Fragment>
            ))}
          </ChakraBreadcrumb.List>
        </ChakraBreadcrumb.Root>
      ) : null}
      <Box css={styles.titleRow}>
        <chakra.h1 css={styles.title}>{title}</chakra.h1>
        {actions ? <Box css={styles.actions}>{actions}</Box> : null}
        {meta ? <Box css={styles.meta}>{meta}</Box> : null}
      </Box>
    </Box>
  );
}

/**
 * meta 行の区切り "·"。支援技術には読ませない。
 */
export function MetaSeparator() {
  return (
    <chakra.span aria-hidden="true" color="fg.subtle">
      ·
    </chakra.span>
  );
}
