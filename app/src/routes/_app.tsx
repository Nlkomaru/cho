import { Box, Flex } from "@chakra-ui/react";
import { createFileRoute, Outlet, useMatches, useRouterState } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/ui/app-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { breadcrumbsFromLoaderData } from "@/lib/breadcrumbs";

export const Route = createFileRoute("/_app")({
  staticData: {
    breadcrumbs: [{ label: "食事記録", to: "/" }],
  },
  component: AppLayout,
});

function AppLayout() {
  const nested = useRouterState({
    select: (state) => state.location.pathname.split("/").filter(Boolean).length > 1,
  });

  return (
    <Flex minH="100vh" bg="bg.canvas">
      <AppSidebar />
      <Box as="section" flex="1" minW="0">
        {nested ? (
          <AppHeader>
            <AppBreadcrumb />
          </AppHeader>
        ) : null}
        <Outlet />
      </Box>
    </Flex>
  );
}

function AppBreadcrumb() {
  const breadcrumbs = useMatches({
    select: (matches) =>
      matches.flatMap(
        (match) =>
          breadcrumbsFromLoaderData(match.loaderData) ?? match.staticData.breadcrumbs ?? [],
      ),
  });

  return <Breadcrumb items={breadcrumbs} />;
}
