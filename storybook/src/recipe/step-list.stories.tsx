import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { StepList, type StepListProps } from "@/components/recipe/step-list";

import { curryRecipe, currySchedule, gratinDish, gratinSchedule } from "./fixtures";

function InteractiveStepList(props: StepListProps) {
  const [completed, setCompleted] = useState(props.completedStepIds);
  return (
    <StepList
      {...props}
      completedStepIds={completed}
      onToggleComplete={(stepId) =>
        setCompleted((current) =>
          current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId],
        )
      }
    />
  );
}

const meta = {
  title: "Recipe/StepList",
  component: StepList,
  render: (args) => (
    <Box maxW="760px">
      <InteractiveStepList {...args} />
    </Box>
  ),
  args: {
    recipe: curryRecipe,
    bars: currySchedule.bars,
    scale: 1,
    completedStepIds: [],
    onToggleComplete: () => {},
  },
} satisfies Meta<typeof StepList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Curry: Story = {};

/** 注意のある手順 (吹きこぼれ・焦げつき) だけ。 */
export const WithCautions: Story = {
  args: {
    recipe: {
      ...curryRecipe,
      steps: curryRecipe.steps.filter((step) => step.cautions.length > 0),
    },
  },
};

export const PartiallyCompleted: Story = {
  args: { completedStepIds: ["s-rice", "s-cut", "s-saute"] },
};

export const Active: Story = { args: { activeStepId: "s-simmer" } };

export const Gratin: Story = {
  args: { recipe: gratinDish.recipe, bars: gratinSchedule.bars, scale: 2 },
};
