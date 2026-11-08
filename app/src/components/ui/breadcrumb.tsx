import { Box, Link, useSlotRecipe } from "@chakra-ui/react";

import { breadcrumb } from "../../../theme/slot-recipes/breadcrumb";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const recipe = useSlotRecipe({ recipe: breadcrumb });
  const styles = recipe();

  return (
    <Box as="nav" aria-label="パンくずリスト" css={styles.root}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;

        return (
          <Box key={`${item.label}-${item.to ?? "current"}`} css={styles.item}>
            {index > 0 ? (
              <Box as="span" aria-hidden="true" css={styles.separator}>
                /
              </Box>
            ) : null}
            {isCurrent || !item.to ? (
              <Box as="span" aria-current="page" css={styles.current}>
                {item.label}
              </Box>
            ) : (
              <Link href={item.to} css={styles.link}>
                {item.label}
              </Link>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
