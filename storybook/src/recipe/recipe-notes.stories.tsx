import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { RecipeNotes } from "@/components/recipe/recipe-notes";

import { curryDish, curryRecipe } from "./fixtures";

const meta = {
  title: "Recipe/RecipeNotes",
  component: RecipeNotes,
  render: (args) => (
    <Box maxW="320px">
      <RecipeNotes {...args} />
    </Box>
  ),
  args: {
    summary: curryRecipe.summary,
    notes: curryDish.notes,
    equipment: curryRecipe.equipment,
    cautions: curryRecipe.globalCautions,
  },
} satisfies Meta<typeof RecipeNotes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EquipmentOnly: Story = {
  args: { summary: null, notes: null, cautions: [] },
};

export const CriticalCaution: Story = {
  args: {
    summary: null,
    notes: null,
    equipment: [],
    cautions: [
      {
        id: "c-raw",
        category: "safety",
        severity: "critical",
        title: "加熱不足",
        description: "鶏肉は中心温度75℃で1分以上加熱する。",
        triggerCondition: null,
      },
    ],
  },
};
