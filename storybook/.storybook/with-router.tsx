import type { Decorator } from "@storybook/react-vite";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { useState } from "react";

/**
 * アプリの Link / useLocation を使うコンポーネントのために、
 * 各ストーリーをメモリ履歴のルーターの中で描画する。
 * 初期パスは `parameters.router.path` (既定 "/")。
 */
export const withRouter: Decorator = (Story, context) => {
  const path = (context.parameters.router as { path?: string } | undefined)?.path ?? "/";
  return <StoryRouter path={path} Story={Story} />;
};

function StoryRouter({ path, Story }: { path: string; Story: () => React.ReactNode }) {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: () => <Story /> }),
      history: createMemoryHistory({ initialEntries: [path] }),
    }),
  );
  return <RouterProvider router={router} />;
}
