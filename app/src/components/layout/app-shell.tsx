import { Box, chakra } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import { AppHeader } from "./app-header";

export interface AppShellProps {
  pathname: string;
  children: ReactNode;
}

/**
 * アプリ全体の枠。スキップリンク → ヘッダー → main の順に並べ、トーストを置く。
 */
export function AppShell({ pathname, children }: AppShellProps) {
  return (
    <Box minH="100dvh" bg="bg.canvas" display="flex" flexDirection="column">
      <chakra.a
        href="#main"
        position="absolute"
        left="4"
        top="-20"
        zIndex="30"
        px="4"
        py="2"
        bg="navy.900"
        color="white"
        fontWeight="600"
        borderRadius="full"
        _focusVisible={{ top: "3", outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
      >
        本文へ移動
      </chakra.a>
      <AppHeader pathname={pathname} />
      <Box as="main" id="main" tabIndex={-1} flex="1" minW="0" _focus={{ outline: "none" }}>
        {children}
      </Box>
      <Toaster />
    </Box>
  );
}
