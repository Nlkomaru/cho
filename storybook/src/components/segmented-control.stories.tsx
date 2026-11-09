import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutList, Table2 } from "lucide-react";
import { useState } from "react";

import { SegmentedControl, type SegmentedControlProps } from "@/components/ui/segmented-control";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "期間",
    value: "week",
    onChange: () => undefined,
    items: [
      { value: "day", label: "日" },
      { value: "week", label: "週" },
      { value: "month", label: "月" },
    ],
  },
  argTypes: { size: { control: "inline-radio", options: ["xs", "sm", "md"] } },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: SegmentedControlProps<string>) {
  const [value, setValue] = useState(props.value);
  return <SegmentedControl {...props} value={value} onChange={setValue} />;
}

export const Period: Story = {
  render: (args) => <Controlled {...args} />,
};

function Examples() {
  const [view, setView] = useState<"card" | "table">("card");
  const [basis, setBasis] = useState<"total" | "serving">("total");
  const [method, setMethod] = useState<"ai" | "recipe" | "ingredients" | "manual">("ai");
  return (
    <Stack gap="5" align="flex-start">
      <SegmentedControl
        label="表示"
        value={view}
        onChange={setView}
        items={[
          {
            value: "card",
            label: (
              <>
                <LayoutList />
                カード
              </>
            ),
          },
          {
            value: "table",
            label: (
              <>
                <Table2 />表
              </>
            ),
          },
        ]}
      />
      <SegmentedControl
        label="栄養価の基準"
        size="xs"
        value={basis}
        onChange={setBasis}
        items={[
          { value: "total", label: "全量" },
          { value: "serving", label: "1人前" },
        ]}
      />
      <SegmentedControl
        label="入力方法"
        size="md"
        value={method}
        onChange={setMethod}
        items={[
          { value: "ai", label: "AI解析" },
          { value: "recipe", label: "レシピ" },
          { value: "ingredients", label: "材料" },
          { value: "manual", label: "手入力" },
        ]}
      />
    </Stack>
  );
}

export const Examples_: Story = { name: "使用例", render: () => <Examples /> };
