import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { GanttChart, type GanttChartProps } from "@/components/recipe/gantt-chart";

import { curryRecipe, currySchedule, emptySchedule, gratinDish, gratinSchedule } from "./fixtures";

// 選択を内部で持つラッパー。バーを押すと行が強調される
function InteractiveGantt(props: GanttChartProps) {
  const [active, setActive] = useState(props.activeStepId ?? null);
  return (
    <GanttChart
      {...props}
      activeStepId={active}
      onStepSelect={(stepId) => {
        setActive(stepId);
        props.onStepSelect?.(stepId);
      }}
    />
  );
}

const meta = {
  title: "Recipe/GanttChart",
  component: GanttChart,
  render: (args) => <InteractiveGantt {...args} />,
  args: { schedule: currySchedule, steps: curryRecipe.steps },
} satisfies Meta<typeof GanttChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 炊飯と並行して進む 6 手順。赤はクリティカルパス。 */
export const Curry: Story = {};

/** 1 本道の 4 手順 (すべてクリティカルパス)。 */
export const LinearGratin: Story = {
  args: { schedule: gratinSchedule, steps: gratinDish.recipe.steps },
};

export const WithActiveStep: Story = { args: { activeStepId: "s-simmer" } };

export const Completed: Story = {
  args: { completedStepIds: ["s-rice", "s-cut", "s-saute"], activeStepId: "s-simmer" },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const Empty: Story = { args: { schedule: emptySchedule, steps: [] } };
