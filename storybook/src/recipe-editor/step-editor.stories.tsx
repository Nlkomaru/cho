import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { RecipeStep } from "@/domain/recipe";
import { StepEditor } from "@/routes/_app/dishes/new/-components/step-editor";

import { curryDraft } from "./fixtures";

const { recipe } = curryDraft;

function StepEditorDemo({
  stepIndex,
  initiallyExpanded,
  errors,
  errorCount,
}: {
  stepIndex: number;
  initiallyExpanded: boolean;
  errors?: Record<string, string>;
  errorCount?: number;
}) {
  const [steps, setSteps] = useState<RecipeStep[]>(recipe.steps);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const step = steps[stepIndex];
  return (
    <Stack as="ol" maxW="800px" m="0" p="0">
      <StepEditor
        step={step}
        steps={steps}
        entries={recipe.ingredients}
        groups={recipe.ingredientGroups}
        expanded={expanded}
        onExpandedChange={setExpanded}
        errors={errors}
        errorCount={errorCount}
        onChange={(patch) =>
          setSteps((current) =>
            current.map((item) => (item.id === step.id ? { ...item, ...patch } : item)),
          )
        }
        onRemove={() => undefined}
      />
    </Stack>
  );
}

/**
 * 手順 1 件の編集カード。閉じると番号・タイトル・時間・依存の 1 行、開くと 基本 / 時間 / 投入・生成 / 依存 /
 * 器具・火加減・完了の目安 / 注意 の小見出しに分かれる。
 */
const meta = {
  title: "RecipeEditor/StepEditor",
  component: StepEditorDemo,
  args: { stepIndex: 3, initiallyExpanded: true },
} satisfies Meta<typeof StepEditorDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Collapsed: Story = {
  args: { initiallyExpanded: false },
};

export const CollapsedList: Story = {
  render: () => (
    <Stack as="ol" gap="2" maxW="800px" m="0" p="0">
      {recipe.steps.map((step) => (
        <StepEditor
          key={step.id}
          step={step}
          steps={recipe.steps}
          entries={recipe.ingredients}
          groups={recipe.ingredientGroups}
          expanded={false}
          onExpandedChange={() => undefined}
          onChange={() => undefined}
          onRemove={() => undefined}
        />
      ))}
    </Stack>
  ),
};

export const WithErrors: Story = {
  args: {
    stepIndex: 0,
    initiallyExpanded: false,
    errorCount: 2,
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const WithIngredientInputs: Story = {
  args: { stepIndex: 1 },
};
