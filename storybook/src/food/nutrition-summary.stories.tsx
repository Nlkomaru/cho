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
