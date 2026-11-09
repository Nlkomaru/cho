import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Field } from "@/components/ui/field";
import type { RecipeIngredientGroup, RecipeStep } from "@/domain/recipe";
import { CautionEditor, CautionList } from "@/routes/_app/dishes/new/-components/caution-editor";
import { EditorActionBar } from "@/routes/_app/dishes/new/-components/editor-action-bar";
import { GroupManager } from "@/routes/_app/dishes/new/-components/group-manager";
import { fieldIds, type RecipeCaution } from "@/routes/_app/dishes/new/-components/recipe-draft";
import { StepIoEditor } from "@/routes/_app/dishes/new/-components/step-io-editor";
import { TagInput } from "@/routes/_app/dishes/new/-components/tag-input";

import { curryDraft } from "./fixtures";

const { recipe } = curryDraft;

/**
 * レシピ編集画面の部品。手順カードや材料の行の中で使う小さな入力。
 */
const meta = {
  title: "RecipeEditor/Parts",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function TagInputDemo({ initial }: { initial: string[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <Box maxW="420px">
      <Field label="器具" helperText="Enter または読点で区切る">
        <TagInput value={tags} onChange={setTags} placeholder="鍋、まな板" />
      </Field>
    </Box>
  );
}

export const TagInputFilled: Story = {
  render: () => <TagInputDemo initial={["厚手の鍋", "包丁", "まな板"]} />,
};

export const TagInputEmpty: Story = { render: () => <TagInputDemo initial={[]} /> };

function GroupManagerDemo({
  initial,
  errors,
}: {
  initial: RecipeIngredientGroup[];
  errors?: Record<string, string>;
}) {
  const [groups, setGroups] = useState(initial);
  return (
    <Box maxW="640px">
      <GroupManager
        groups={groups}
        errors={errors}
        onChange={(id, patch) =>
          setGroups((current) =>
            current.map((group) => (group.id === id ? { ...group, ...patch } : group)),
          )
        }
        onRemove={(id) => setGroups((current) => current.filter((group) => group.id !== id))}
        onAdd={() =>
          setGroups((current) => [
            ...current,
            {
              id: `g-${current.length + 1}`,
              symbol: "☆",
              label: "",
              ingredientEntryIds: [],
            } as RecipeIngredientGroup,
          ])
        }
      />
    </Box>
  );
}

export const GroupManagerFilled: Story = {
  render: () => <GroupManagerDemo initial={recipe.ingredientGroups} />,
};

export const GroupManagerEmpty: Story = { render: () => <GroupManagerDemo initial={[]} /> };

export const GroupManagerInvalid: Story = {
  render: () => {
    const groups = recipe.ingredientGroups.map((group) => ({ ...group, label: "" }));
    return (
      <GroupManagerDemo
        initial={groups}
        errors={Object.fromEntries(
          groups.map((group) => [fieldIds.group(group.id), "グループ名を入力してください"]),
        )}
      />
    );
  },
};

const firstCaution: RecipeCaution =
  recipe.steps.flatMap((step) => step.cautions)[0] ?? recipe.globalCautions[0];

export const CautionSingle: Story = {
  render: () => (
    <Stack as="ul" maxW="640px" m="0" p="0">
      <CautionEditor
        caution={firstCaution}
        index={0}
        onChange={() => undefined}
        onRemove={() => undefined}
      />
    </Stack>
  ),
};

function CautionListDemo({
  initial,
  errors,
}: {
  initial: RecipeCaution[];
  errors?: Record<string, string>;
}) {
  const [cautions, setCautions] = useState(initial);
  return (
    <Box maxW="640px">
      <CautionList cautions={cautions} errors={errors} onChange={setCautions} />
    </Box>
  );
}

export const CautionListFilled: Story = {
  render: () => (
    <CautionListDemo
      initial={[...recipe.globalCautions, ...recipe.steps.flatMap((s) => s.cautions)]}
    />
  ),
};

export const CautionListEmpty: Story = { render: () => <CautionListDemo initial={[]} /> };

export const CautionListInvalid: Story = {
  render: () => {
    const blank: RecipeCaution = { ...firstCaution, id: "c-blank", title: "", description: "" };
    return (
      <CautionListDemo
        initial={[blank]}
        errors={{
          [fieldIds.caution(blank.id, "title")]: "見出しを入力してください",
          [fieldIds.caution(blank.id, "description")]: "説明を入力してください",
        }}
      />
    );
  },
};

function StepIoDemo({ stepIndex }: { stepIndex: number }) {
  const [steps, setSteps] = useState<RecipeStep[]>(recipe.steps);
  const step = steps[stepIndex];
  return (
    <Box maxW="720px">
      <StepIoEditor
        step={step}
        steps={steps}
        entries={recipe.ingredients}
        groups={recipe.ingredientGroups}
        onChange={(patch) =>
          setSteps((current) =>
            current.map((item) => (item.id === step.id ? { ...item, ...patch } : item)),
          )
        }
      />
    </Box>
  );
}

/** 生の材料を投入する手順。 */
export const StepIoIngredients: Story = { render: () => <StepIoDemo stepIndex={1} /> };

/** 前の手順の生成物とグループを投入する手順。 */
export const StepIoIntermediate: Story = { render: () => <StepIoDemo stepIndex={4} /> };

export const StepIoMobile: Story = {
  render: () => <StepIoDemo stepIndex={4} />,
  globals: { viewport: { value: "mobile", isRotated: false } },
};

const actionBarArgs = {
  submitLabel: "保存",
  onCancel: () => undefined,
  onIssueSelect: () => undefined,
  fixed: false,
};

export const ActionBar: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <EditorActionBar {...actionBarArgs} issues={[]} />,
};

export const ActionBarIssues: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <EditorActionBar
      {...actionBarArgs}
      issues={[
        { fieldId: fieldIds.name, message: "料理名を入力してください" },
        { fieldId: fieldIds.servings, message: "人数は 1 以上にしてください" },
      ]}
    />
  ),
};

export const ActionBarBusy: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <EditorActionBar {...actionBarArgs} issues={[]} busy />,
};

export const ActionBarError: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <EditorActionBar {...actionBarArgs} issues={[]} error="保存できませんでした。" />,
};

export const ActionBarMobile: Story = {
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => (
    <EditorActionBar
      {...actionBarArgs}
      issues={[{ fieldId: fieldIds.name, message: "料理名を入力してください" }]}
    />
  ),
};
