import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { MealEntryDrawer } from "@/components/meal/meal-entry-drawer";
import { MealItemsEditor } from "@/components/meal/meal-items-editor";
import { MealPhotoTiles, type MealPhoto } from "@/components/meal/meal-photo-tiles";
import type { MealItem } from "@/components/meal/meal-shared";

import { cafeteriaMeal, photoSrc } from "./fixtures";

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

/** AI 解析 (既定)。写真と説明を入れて解析する。 */
export const Analyze: Story = {};

export const Manual: Story = { args: { initialMethod: "manual" } };

/** 既存の記録の編集。入力方法は出さず、品目と共通項目を編集する。 */
export const Edit: Story = { args: { meal: cafeteriaMeal } };

export const Mobile: Story = {
  args: { initialMethod: "manual" },
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

function ItemsDemo() {
  const [items, setItems] = useState<MealItem[]>(cafeteriaMeal.items);
  return <MealItemsEditor items={items} onChange={setItems} />;
}

export const ItemsEditor: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ maxWidth: 432 }}>
      <ItemsDemo />
    </div>
  ),
};
