import { HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Trash2 } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  parameters: { layout: "padded" },
  args: {
    content: "キーをコピー",
    open: true,
    placement: "top",
    children: (
      <IconButton variant="ghost" aria-label="キーをコピー">
        <Copy />
      </IconButton>
    ),
  },
  argTypes: {
    placement: { control: "inline-radio", options: ["top", "bottom", "left", "right"] },
    open: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "64px 160px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Bottom: Story = {
  args: { placement: "bottom" },
};

export const LongContent: Story = {
  args: {
    content: "11月10日 18:30 · 12 回 · 最後の呼び出し search_dishes",
  },
};

/** ホバーかフォーカスで開く。 */
export const Hover: Story = {
  args: { open: undefined },
  render: (args) => (
    <HStack gap="2">
      <Tooltip {...args} content="複製">
        <IconButton variant="ghost" aria-label="複製">
          <Copy />
        </IconButton>
      </Tooltip>
      <Tooltip {...args} content="削除">
        <IconButton variant="ghost" aria-label="削除">
          <Trash2 />
        </IconButton>
      </Tooltip>
    </HStack>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};
