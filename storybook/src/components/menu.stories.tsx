import { Menu, Portal } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { IconButton } from "@/components/ui/button";

function OverflowMenu({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <Menu.Root defaultOpen={defaultOpen} positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton variant="outline" aria-label="その他の操作">
          <MoreHorizontal />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="edit-meta">
              <Pencil />
              名前・カテゴリ・メモを編集
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="delete">
              <Trash2 />
              削除
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

const meta = {
  title: "Components/Menu",
  component: OverflowMenu,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 200, display: "flex", justifyContent: "flex-end", maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OverflowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overflow: Story = {};
