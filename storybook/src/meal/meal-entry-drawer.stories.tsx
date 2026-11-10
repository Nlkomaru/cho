import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { MealEntryDrawer } from "@/components/meal/meal-entry-drawer";
import { MealItemsEditor } from "@/components/meal/meal-items-editor";
import { MealPhotoTiles, type MealPhoto } from "@/components/meal/meal-photo-tiles";
import type { Dish, MealItem } from "@/components/meal/meal-shared";

import { buildNutritionFacts } from "../fixtures/food";
import { buildMealItem, cafeteriaMeal, photoSrc } from "./fixtures";

const meta = {
  title: "Meal/MealEntryDrawer",
  component: MealEntryDrawer,
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSaved: () => undefined,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MealEntryDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 手入力 (既定)。品目を並べ、レシピ・材料・AI解析からも足せる。 */
export const Manual: Story = {};

/** AI 解析。写真と説明から推定した品目を一覧に足す。 */
export const Analyze: Story = { args: { initialMethod: "ai" } };

/** 既存の記録の編集。品目の追加方法は記録と同じものを使う。 */
export const Edit: Story = { args: { meal: cafeteriaMeal } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

function TilesDemo() {
  const [photos, setPhotos] = useState<MealPhoto[]>([
    { key: "a", src: photoSrc(20) },
    { key: "b", src: photoSrc(140) },
  ]);
  return (
    <MealPhotoTiles
      photos={photos}
      onAdd={(files) =>
        setPhotos((current) => [
          ...current,
          ...files.map((file) => ({ key: file.name, src: URL.createObjectURL(file) })),
        ])
      }
      onRemove={(key) => setPhotos((current) => current.filter((photo) => photo.key !== key))}
    />
  );
}

export const PhotoTiles: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ maxWidth: 432 }}>
      <TilesDemo />
    </div>
  ),
};

const demoDishes: Dish[] = [
  {
    id: "dish-saba",
    name: "サバの塩焼き",
    servings: 1,
    totalNutrition: buildNutritionFacts(),
    totalCostYen: 160,
    costMissingCount: 0,
  },
  {
    id: "dish-miso",
    name: "豆腐とわかめの味噌汁",
    servings: 2,
    totalNutrition: buildNutritionFacts(),
    totalCostYen: 45,
    costMissingCount: 0,
  },
];

/** 焼き魚定食を品目ごとに記録した例。ごはんはレシピにつないでいない。 */
function ItemsDemo() {
  const [items, setItems] = useState<MealItem[]>([
    buildMealItem({
      name: "サバの塩焼き",
      dishId: "dish-saba",
      estimationSource: "recipe",
      priceYen: 160,
    }),
    buildMealItem({
      name: "豆腐とわかめの味噌汁",
      dishId: "dish-miso",
      estimationSource: "recipe",
      priceYen: 45,
    }),
    buildMealItem({ name: "ごはん", priceYen: 40 }),
  ]);
  return <MealItemsEditor items={items} onChange={setItems} dishes={demoDishes} />;
}

export const ItemsEditor: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ maxWidth: 432 }}>
      <ItemsDemo />
    </div>
  ),
};
