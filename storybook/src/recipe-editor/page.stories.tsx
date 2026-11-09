import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppShell } from "@/components/layout/app-shell";
import { RecipeEditor } from "@/routes/_app/dishes/new/-components/recipe-editor";

import { blankDraftFixture, curryDraft, editorIngredients, resolveLater } from "./fixtures";

/**
 * レシピ作成・編集画面 (データ取得なし)。lg 以上は左に目次、下に保存バー。
 */
const meta = {
  title: "RecipeEditor/Page",
  component: RecipeEditor,
  parameters: { layout: "fullscreen", router: { path: "/dishes/new" } },
  render: (args) => (
    <AppShell pathname="/dishes/new">
      <RecipeEditor {...args} />
    </AppShell>
  ),
  args: {
    mode: "edit",
    initial: curryDraft,
    ingredients: editorIngredients,
    dish: { id: "dish-curry", name: "ポークカレー" },
    onSave: () => resolveLater(undefined),
    onStructure: () => resolveLater(curryDraft.recipe),
    onCancel: () => undefined,
  },
} satisfies Meta<typeof RecipeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditDesktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const EditMobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const CreateDesktop: Story = {
  args: { mode: "create", initial: blankDraftFixture, dish: undefined },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const CreateMobile: Story = {
  args: { mode: "create", initial: blankDraftFixture, dish: undefined },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
