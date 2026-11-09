import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { NutritionSummary } from "@/components/food/nutrition-summary";

import { curryTotalFacts } from "../fixtures/food";

const meta = {
  title: "Food/NutritionSummary",
  component: NutritionSummary,
  args: { facts: curryTotalFacts, costYen: 1240 },
  argTypes: { layout: { control: "inline-radio", options: ["stack", "row"] } },
  render: (args) => (
    <Box maxW={args.layout === "row" ? "1100px" : "320px"}>
      <NutritionSummary {...args} />
    </Box>
  ),
} satisfies Meta<typeof NutritionSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stack: Story = {};

export const WithServings: Story = { args: { servings: 4 } };

export const Row: Story = { args: { layout: "row", servings: 4 } };

export const MissingFacts: Story = { args: { facts: null, costYen: null } };

/** 全材料に単価がある。 */
export const CostComplete: Story = { args: { costYen: 1240, costMissingCount: 0 } };

/** 一部の材料に単価が無い。原価は下限として出す。 */
export const CostPartial: Story = { args: { costYen: 1240, costMissingCount: 2 } };

export const CostPartialRow: Story = {
  args: { layout: "row", servings: 4, costYen: 1240, costMissingCount: 2 },
};

/** どの材料にも単価が無い。 */
export const CostNone: Story = { args: { costYen: null, costMissingCount: 9 } };
