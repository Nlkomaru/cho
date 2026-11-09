import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatGroup, StatPart } from "@/components/ui/stat-group";

const meta = {
  title: "Components/StatGroup",
  component: StatGroup,
  args: {
    label: "期間の集計",
    items: [
      { label: "料金", value: "¥1,240", note: "1日平均 ¥413" },
      { label: "エネルギー", value: "1,830", unit: "kcal" },
      {
        label: "PFC",
        value: (
          <>
            <StatPart label="P" value="74.2" unit="g" />
            <StatPart label="F" value="58.1" unit="g" />
            <StatPart label="C" value="248.6" unit="g" />
          </>
        ),
      },
      { label: "食物繊維・食塩", value: "12.4", unit: "g", note: "食塩 8.1 g" },
    ],
  },
  argTypes: { size: { control: "inline-radio", options: ["md", "sm"] } },
} satisfies Meta<typeof StatGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const ThreeColumns: Story = {
  args: {
    columns: { base: 1, md: 3, lg: 3 },
    items: [
      { label: "呼び出し回数", value: "1,284" },
      { label: "成功率", value: "99.2", unit: "%" },
      { label: "平均応答", value: "182", unit: "ms" },
    ],
  },
};
