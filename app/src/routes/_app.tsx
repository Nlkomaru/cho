import { Box, Flex } from "@chakra-ui/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppNav } from "@/components/app-nav";

export const Route = createFileRoute("/_app")({
  staticData: {
    breadcrumbs: [{ label: "食事記録", to: "/" }],
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <Flex minH="100vh" direction="column" bg="bg.canvas">
      <AppNav />
      <Box flex="1" minW="0">
        <Outlet />
      </Box>
    </Flex>
  );
}
