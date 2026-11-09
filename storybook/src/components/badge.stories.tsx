import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Flame, Hourglass, Link2, Timer } from "lucide-react";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { children: "主菜" },
  argTypes: {
    variant: { control: "inline-radio", options: ["subtle", "outline", "solid"] },
    colorPalette: { control: "inline-radio", options: ["navy", "red", "green", "amber"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Usage: Story = {
  render: () => (
    <Stack gap="5">
      <HStack gap="4">
        <Text w="32" textStyle="label" color="fg.muted">
          区分
        </Text>
        <HStack gap="2">
          <Badge>主菜</Badge>
          <Badge>副菜</Badge>
          <Badge>自炊</Badge>
        </HStack>
      </HStack>
      <HStack gap="4">
        <Text w="32" textStyle="label" color="fg.muted">
          手順のメタ
        </Text>
        <HStack gap="2" wrap="wrap">
          <Badge variant="outline">
            <Timer />
            作業 3分
          </Badge>
          <Badge variant="outline">
            <Hourglass />
            待機 20分
          </Badge>
          <Badge variant="outline">
            <Flame />
            中火
          </Badge>
        </HStack>
      </HStack>
      <HStack gap="4">
        <Text w="32" textStyle="label" color="fg.muted">
          状態
        </Text>
        <HStack gap="2" wrap="wrap">
          <Badge colorPalette="red">クリティカルパス</Badge>
          <Badge colorPalette="green">
            <Link2 />
            連携済み
          </Badge>
          <Badge colorPalette="amber">期限切れ間近</Badge>
          <Badge colorPalette="red">エラー</Badge>
        </HStack>
      </HStack>
    </Stack>
  ),
};
