import type { Meta, StoryObj } from "@storybook/react-vite";
import { CookingPot, Plus, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  args: {
    title: "レシピがありません",
    description: "最初のレシピを登録すると、ここに一覧が表示されます。",
    icon: <CookingPot strokeWidth={1.75} />,
    action: (
      <Button variant="outline">
        <Plus />
        レシピを追加
      </Button>
    ),
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoResults: Story = {
  args: {
    title: "一致するレシピがありません",
    description: undefined,
    icon: <SearchX strokeWidth={1.75} />,
    action: undefined,
  },
};

export const Small: Story = {
  args: { size: "sm", title: "この期間の記録はありません", description: undefined },
};
