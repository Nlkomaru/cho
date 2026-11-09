import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_app")({
  staticData: {
    breadcrumbs: [{ label: "食事記録", to: "/" }],
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <AppShell pathname={pathname}>
      <Outlet />
    </AppShell>
  );
}
