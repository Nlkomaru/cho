import { Badge, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: {
    title: "ポークカレー",
    meta: "主菜 · 4人前 · 52分",
    children: <Text color="fg.muted">玉ねぎを飴色になるまで炒め、隠し味にりんごを加える。</Text>,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["outline", "subtle", "plain"] },
    padding: { control: "inline-radio", options: ["sm", "md"] },
  },
  render: (args) => (
    <Stack maxW="420px">
      <Card {...args} />
    </Stack>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outline: Story = {};

export const WithDivider: Story = {
  args: {
    divider: true,
    footer: (
      <Button variant="outline" size="sm">
        開く
        <ArrowRight />
      </Button>
    ),
  },
};

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="ghost" size="xs">
        編集
      </Button>
    ),
  },
};

export const Subtle: Story = {
  args: { variant: "subtle", title: "メモ", meta: undefined },
};

export const Grid4: Story = {
  render: () => (
    <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4" maxW="1000px">
      {["OpenRouter", "Inventia", "MCP"].map((name, index) => (
        <Card
          key={name}
          title={name}
          divider
          meta={
            <HStack gap="2" mt="1">
              <Badge colorPalette={index === 1 ? "green" : "navy"}>
                {index === 1 ? "接続済み" : "未設定"}
              </Badge>
            </HStack>
          }
        >
          <Text textStyle="body.sm" color="fg.muted">
            最終同期 11月10日 18:30
          </Text>
        </Card>
      ))}
    </Grid>
  ),
};
