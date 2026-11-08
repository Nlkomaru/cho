import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { breadcrumbsFromLoaderData } from "@/lib/breadcrumbs";

export const Route = createFileRoute("/_app")({
  staticData: {
    breadcrumbs: [{ label: "食事記録", to: "/" }],
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <Flex minH="100vh" bg="bg.canvas">
      <AppSidebar />
      <Box as="section" flex="1" minW="0">
        <Box
          as="header"
          position="sticky"
          top="0"
          zIndex="20"
          display="flex"
          minH="4rem"
          alignItems="center"
          borderBottomWidth="1px"
          borderColor="border"
          bg="bg.panel"
          px="6"
        >
          <AppBreadcrumb />
        </Box>
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

  return (
    <Box as="nav" aria-label="パンくずリスト" display="flex" gap="2">
      {breadcrumbs.map((breadcrumb, index) => {
        const isCurrent = index === breadcrumbs.length - 1;

        return (
          <Box key={`${breadcrumb.label}-${breadcrumb.to ?? "current"}`} display="flex" gap="2">
            {index > 0 ? <Text aria-hidden="true">/</Text> : null}
            {isCurrent || !breadcrumb.to ? (
              <Text aria-current="page" color="fg.subtle" fontWeight="600">
                {breadcrumb.label}
              </Text>
            ) : (
              <Link href={breadcrumb.to} color="fg">
                {breadcrumb.label}
              </Link>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
