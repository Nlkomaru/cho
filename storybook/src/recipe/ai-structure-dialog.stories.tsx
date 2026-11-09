import type { Meta, StoryObj } from "@storybook/react-vite";

import { AiStructureDialog } from "@/routes/_app/dishes/new/-components/ai-structure-dialog";

/** 作り方の文章を AI に渡し、手順の構造に変換するダイアログ。 */
const meta = {
  title: "Recipe/AiStructureDialog",
  component: AiStructureDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    missing: [],
    stepCount: 0,
    onSubmit: () => undefined,
  },
} satisfies Meta<typeof AiStructureDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReplacesSteps: Story = { args: { stepCount: 6 } };

export const MissingInput: Story = { args: { missing: ["料理名", "材料"] } };

export const Busy: Story = { args: { busy: true } };

export const Failed: Story = { args: { error: "AI からの応答を読み取れませんでした。" } };

export const Mobile: Story = { globals: { viewport: { value: "mobile", isRotated: false } } };
