import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { NutritionInline } from "@/components/food/nutrition-inline";

import { buildNutritionFacts } from "../fixtures/food";

const meta = {
  title: "Food/NutritionInline",
  component: NutritionInline,
  args: { facts: buildNutritionFacts() },
  argTypes: { size: { control: "inline-radio", options: ["sm", "xs"] } },
} satisfies Meta<typeof NutritionInline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCost: Story = { args: { costYen: 480 } };

export const CostMissing: Story = { args: { costYen: null, costMissing: true } };

export const Sizes: Story = {
  render: () => (
    <Stack gap="3">
      <NutritionInline facts={buildNutritionFacts()} costYen={480} />
      <NutritionInline facts={buildNutritionFacts()} size="xs" />
    </Stack>
  ),
};

export const Missing: Story = { args: { facts: null } };
