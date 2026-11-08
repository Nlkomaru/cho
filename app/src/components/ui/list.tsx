import { Box, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { list } from "../../../theme/slot-recipes/list";

export interface ListProps {
  divided?: boolean;
  children: ReactNode;
}

export function List({ divided = true, children }: ListProps) {
  const recipe = useSlotRecipe({ recipe: list });

  return (
    <Box as="div" css={recipe({ divided }).root}>
      {children}
    </Box>
  );
}

export interface ListItemProps {
  layout?: "stack" | "row";
  children: ReactNode;
}

export function ListItem({ layout = "stack", children }: ListItemProps) {
  const recipe = useSlotRecipe({ recipe: list });

  return (
    <Box as="div" css={recipe({ layout }).item}>
      {children}
    </Box>
  );
}
