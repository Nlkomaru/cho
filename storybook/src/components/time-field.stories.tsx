import { Grid } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { TimeField } from "@/components/ui/time-field";

function TimeFieldDemo(
  props: Omit<Parameters<typeof TimeField>[0], "value" | "onChange"> & {
    initial?: string;
  },
) {
  const { initial = "", ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <Grid maxW="240px">
      <TimeField {...rest} value={value} onChange={setValue} />
    </Grid>
  );
}

/**
 * 24 時間表記の時刻入力。"1830" や "18時30分" もフォーカスを外したときに "18:30" へ整える。
 */
const meta = {
  title: "Components/TimeField",
  component: TimeFieldDemo,
  args: { label: "時刻", initial: "18:30" },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md"] } },
} satisfies Meta<typeof TimeFieldDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { initial: "" } };

export const Required: Story = { args: { initial: "", required: true } };

export const WithHelper: Story = { args: { helperText: "食べ始めた時刻" } };

export const Small: Story = { args: { size: "sm" } };

export const Disabled: Story = { args: { disabled: true } };
