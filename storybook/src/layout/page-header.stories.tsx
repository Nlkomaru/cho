import { Badge } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal, Plus } from "lucide-react";

import { MetaSeparator, PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";

const meta = {
  title: "Layout/PageHeader",
  component: PageHeader,
  args: { title: "レシピ" },
  argTypes: {
    size: { control: "inline-radio", options: ["page", "display"] },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ListPage: Story = {
  args: {
    title: "レシピ",
    meta: "12件",
    actions: (
      <Button variant="primary">
        <Plus />
        レシピを追加
      </Button>
    ),
  },
};

export const DetailPage: Story = {
  args: {
    size: "display",
    title: "ポークカレー",
    breadcrumbs: [{ label: "レシピ", to: "/dishes" }],
    meta: (
      <>
        <Badge>主菜</Badge>
        <span>基準 4人前</span>
        <MetaSeparator />
        <span>調理 52分</span>
      </>
    ),
    actions: (
      <>
        <Button variant="primary">食事記録に追加</Button>
        <Button variant="outline">編集</Button>
        <IconButton variant="ghost" aria-label="その他の操作">
          <MoreHorizontal />
        </IconButton>
      </>
    ),
  },
};

export const LongTitle: Story = {
  args: {
    size: "display",
    title: "鶏むね肉と季節野菜のトマト煮込み バジル風味",
    breadcrumbs: [{ label: "レシピ", to: "/dishes" }],
    actions: <Button variant="primary">食事記録に追加</Button>,
  },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
