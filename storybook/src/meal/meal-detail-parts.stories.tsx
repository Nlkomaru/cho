import type { Meta, StoryObj } from "@storybook/react-vite";

import { MealCostList } from "@/components/meal/meal-cost-list";
import { MealItemsTable } from "@/components/meal/meal-items-table";
import { MealPhotoGallery } from "@/components/meal/meal-photo-gallery";

import { cafeteriaMeal, curryMeal, photoSrc } from "./fixtures";

const meta = {
  title: "Meal/DetailParts",
  component: MealItemsTable,
  args: { items: cafeteriaMeal.items },
} satisfies Meta<typeof MealItemsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ItemsTable: Story = {};

export const ItemsTableMobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const CostList: Story = {
  render: () => <MealCostList items={curryMeal.items} />,
};

export const CostListEmpty: Story = {
  render: () => <MealCostList items={cafeteriaMeal.items} />,
};

export const PhotoGallery: Story = {
  render: () => (
    <MealPhotoGallery
      imageIds={["20", "140", "35"]}
      title="ポークカレー"
      resolveSrc={(id) => photoSrc(Number(id))}
    />
  ),
};
