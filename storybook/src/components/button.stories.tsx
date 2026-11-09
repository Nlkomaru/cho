import { HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";

const variants = ["primary", "secondary", "outline", "ghost", "danger", "link"] as const;
const sizes = ["xs", "sm", "md", "lg"] as const;

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "保存する", variant: "outline", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: variants },
    size: { control: "inline-radio", options: sizes },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap="6">
      {variants.map((variant) => (
        <HStack key={variant} gap="6">
          <Text w="24" textStyle="label" color="fg.muted">
            {variant}
          </Text>
          <HStack gap="3" wrap="wrap">
            {sizes.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {variant === "danger"
                  ? "削除する"
                  : variant === "link"
                    ? "すべて見る"
                    : "記録を追加"}
              </Button>
            ))}
          </HStack>
        </HStack>
      ))}
    </Stack>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <HStack gap="3" wrap="wrap">
      <Button variant="primary">
        <Plus />
        レシピを追加
      </Button>
      <Button variant="secondary">
        すべて見る
        <ArrowRight />
      </Button>
      <Button variant="outline">
        <Sparkles />
        テキストから作成
      </Button>
      <Button variant="danger">
        <Trash2 />
        削除
      </Button>
      <Button variant="link">
        すべて見る
        <ArrowRight />
      </Button>
    </HStack>
  ),
};

export const States: Story = {
  render: () => (
    <HStack gap="3" wrap="wrap">
      <Button variant="primary" loading>
        保存
      </Button>
      <Button variant="primary" loading loadingText="保存中">
        保存
      </Button>
      <Button variant="primary" disabled>
        保存
      </Button>
      <Button variant="outline" disabled>
        キャンセル
      </Button>
    </HStack>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <HStack gap="3">
      {sizes.map((size) => (
        <IconButton key={size} size={size} variant="outline" aria-label="その他の操作">
          <MoreHorizontal />
        </IconButton>
      ))}
      <IconButton variant="ghost" aria-label="その他の操作">
        <MoreHorizontal />
      </IconButton>
      <IconButton variant="secondary" aria-label="追加">
        <Plus />
      </IconButton>
    </HStack>
  ),
};
