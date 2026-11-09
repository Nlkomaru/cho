import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  type NutritionForm,
  nutritionFormFrom,
} from "@/routes/_app/ingredients/-components/ingredient-form";
import { NutritionFields } from "@/routes/_app/ingredients/-components/nutrition-fields";

import { ingredients } from "./fixtures";

function NutritionFieldsDemo({
  initial,
  estimating,
}: {
  initial: NutritionForm;
  estimating?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Box maxW="592px">
      <NutritionFields
        value={value}
        onChange={setValue}
        basis="100g あたり"
        onEstimate={() => undefined}
        estimating={estimating}
      />
    </Box>
  );
}

const meta = {
  title: "Catalog/NutritionFields",
  component: NutritionFieldsDemo,
  args: { initial: nutritionFormFrom(ingredients[0].nutritionPerBasis) },
} satisfies Meta<typeof NutritionFieldsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMicronutrients: Story = {
  args: { initial: nutritionFormFrom(ingredients[2].nutritionPerBasis) },
};

export const Estimating: Story = { args: { estimating: true } };

export const Mobile: Story = {
  args: { initial: nutritionFormFrom(ingredients[2].nutritionPerBasis) },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
