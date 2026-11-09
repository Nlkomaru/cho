import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ServingsStepper, type ServingsStepperProps } from "@/components/ui/servings-stepper";

function Controlled(props: ServingsStepperProps) {
  const [value, setValue] = useState(props.value);
  return <ServingsStepper {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Components/ServingsStepper",
  component: ServingsStepper,
  args: { value: 4, onChange: () => undefined },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ServingsStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AtMinimum: Story = { args: { value: 1 } };
