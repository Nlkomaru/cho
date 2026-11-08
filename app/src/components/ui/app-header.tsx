import { Box, useRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { appHeader } from "../../../theme/recipes/app-header";

export function AppHeader({ children }: { children: ReactNode }) {
  const recipe = useRecipe({ recipe: appHeader });

  return (
    <Box as="header" css={recipe()}>
      {children}
    </Box>
  );
}
