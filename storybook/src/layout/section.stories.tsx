import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Section, SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";

const meta = {
  title: "Layout/Section",
  component: Section,
  args: { title: "材料", children: null },
  argTypes: {
    variant: { control: "inline-radio", options: ["rule", "plain"] },
    headingLevel: { control: "inline-radio", options: [2, 3] },
  },
  render: (args) => (
    <Box maxW="720px">
      <Section {...args}>
        <Stack gap="0">
          {["玉ねぎ 2個", "にんじん 1本", "じゃがいも 3個"].map((row) => (
            <Box key={row} py="3" borderBottomWidth="1px" borderColor="border">
              <Text color="fg.strong">{row}</Text>
            </Box>
          ))}
        </Stack>
      </Section>
    </Box>
  ),
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rule: Story = {};

export const WithMetaAndActions: Story = {
  args: {
    title: "手順",
    meta: "3 / 6 完了",
    actions: (
      <Button variant="ghost" size="xs">
        リセット
      </Button>
    ),
  },
};

function PeriodToggle() {
  const [value, setValue] = useState<"day" | "week" | "month">("week");
  return (
    <SegmentedControl
      label="期間"
      value={value}
      onChange={setValue}
      items={[
        { value: "day", label: "日" },
        { value: "week", label: "週" },
        { value: "month", label: "月" },
      ]}
    />
  );
}

export const WithSegmentedControl: Story = {
  args: { title: "利用状況", actions: <PeriodToggle /> },
};

export const Level3: Story = {
  args: { title: "栄養価・原価", headingLevel: 3 },
};

export const Plain: Story = {
  args: { title: undefined, label: "検索結果", variant: "plain" },
};

export const SubHeadings: Story = {
  render: () => (
    <Stack gap="6" maxW="720px">
      <SubHeading>★ 隠し味</SubHeading>
      <SubHeading trailing="3件">MIT</SubHeading>
      <SubHeading>コンロ</SubHeading>
    </Stack>
  ),
};
