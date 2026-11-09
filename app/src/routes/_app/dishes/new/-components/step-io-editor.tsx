import { chakra, Field, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { Plus, X } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  recipeEntryName,
  type IngredientNameLookup,
  type RecipeIngredientEntry,
  type RecipeIngredientGroup,
  type RecipeStep,
} from "@/domain/recipe";

import { DraftNumberInput } from "./draft-number-input";
import { fieldIds, makeId } from "./recipe-draft";
import { ToggleChips } from "./toggle-chips";

type StepInput = RecipeStep["inputs"][number];
type IngredientInput = Extract<StepInput, { type: "ingredient" }>;

export interface StepIoEditorProps {
  step: RecipeStep;
  steps: readonly RecipeStep[];
  entries: readonly RecipeIngredientEntry[];
  /** 材料マスタ。材料名に使う。 */
  ingredientById: IngredientNameLookup;
  groups: readonly RecipeIngredientGroup[];
  errors?: Readonly<Record<string, string>>;
  onChange(patch: Partial<RecipeStep>): void;
}

const percent = (ratio: number | null) =>
  ratio === null ? "" : String(Math.round(ratio * 1000) / 10);

/**
 * 手順の投入 (個別材料・グループ・中間生成物) と生成物。
 */
export function StepIoEditor({
  step,
  steps,
  entries,
  ingredientById,
  groups,
  errors = {},
  onChange,
}: StepIoEditorProps) {
  const ingredientInputs = step.inputs.filter(
    (input): input is IngredientInput => input.type === "ingredient",
  );
  const used = new Set(ingredientInputs.map((input) => input.ingredientEntryId));
  const others = (type: StepInput["type"]) => step.inputs.filter((input) => input.type !== type);

  // 他の手順ですでに使っている割合を引いた残りを初期値にする
  const remainingRatio = (entryId: string) => {
    const usedElsewhere = steps
      .filter((item) => item.id !== step.id)
      .flatMap((item) => item.inputs)
      .reduce(
        (sum, input) =>
          input.type === "ingredient" && input.ingredientEntryId === entryId
            ? sum + input.amountRatio
            : sum,
        0,
      );
    const rest = Math.round((1 - usedElsewhere) * 100) / 100;
    return rest >= 0.01 ? rest : 1;
  };

  const updateIngredient = (entryId: string, patch: Partial<IngredientInput>) =>
    onChange({
      inputs: step.inputs.map((input) =>
        input.type === "ingredient" && input.ingredientEntryId === entryId
          ? { ...input, ...patch }
          : input,
      ),
    });

  const intermediateOptions = steps
    .filter((item) => item.id !== step.id)
    .flatMap((item) =>
      item.outputs
        .filter((output) => output.label.trim())
        .map((output) => ({
          value: `${item.id}::${output.id}`,
          label: `手順${item.stepNumber}: ${output.label}`,
        })),
    );
  const selectedIntermediates = step.inputs.flatMap((input) =>
    input.type === "intermediate" ? [`${input.fromStepId}::${input.outputId}`] : [],
  );

  return (
    <Stack gap="5">
      <Stack gap="2">
        <Text textStyle="label" color="fg.muted">
          個別材料
        </Text>
        {ingredientInputs.length ? (
          <chakra.ul listStyleType="none" m="0" p="0">
            {ingredientInputs.map((input) => {
              const entry = entries.find((item) => item.id === input.ingredientEntryId);
              const name =
                entry && (entry.label || entry.ingredientId)
                  ? recipeEntryName(entry, ingredientById)
                  : "材料";
              const ratioId = fieldIds.step(step.id, `ratio-${input.ingredientEntryId}`);
              return (
                <chakra.li
                  key={input.ingredientEntryId}
                  py="2"
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <Grid
                    templateColumns={{
                      base: "minmax(0, 1fr) 6.5rem auto",
                      md: "minmax(0, 1fr) 6.5rem minmax(0, 1fr) auto",
                    }}
                    gap="3"
                    alignItems="center"
                  >
                    <Text textStyle="body.sm" color="fg.strong" truncate>
                      {name}
                      {entry?.displayAmount ? (
                        <chakra.span color="fg.subtle"> {entry.displayAmount}</chakra.span>
                      ) : null}
                    </Text>
                    <Field.Root
                      ids={{ control: ratioId }}
                      minW="0"
                      invalid={Boolean(errors[ratioId])}
                    >
                      <Field.Label srOnly>{`${name} の使用割合`}</Field.Label>
                      <DraftNumberInput
                        id={ratioId}
                        size="sm"
                        unit="%"
                        value={input.amountRatio}
                        format={percent}
                        parse={(value) => Math.round(value * 10) / 1000}
                        invalid={Boolean(errors[ratioId])}
                        onChange={(value) =>
                          updateIngredient(input.ingredientEntryId, { amountRatio: value ?? 0 })
                        }
                      />
                    </Field.Root>
                    <Field.Root
                      minW="0"
                      gridColumn={{ base: "1 / 3", md: "auto" }}
                      gridRow={{ base: 2, md: "auto" }}
                    >
                      <Field.Label srOnly>{`${name} の分量表記`}</Field.Label>
                      <Input
                        size="sm"
                        maxLength={64}
                        placeholder={entry?.displayAmount || "分量表記"}
                        value={input.amountText ?? ""}
                        onChange={(event) =>
                          updateIngredient(input.ingredientEntryId, {
                            amountText: event.currentTarget.value || null,
                          })
                        }
                      />
                    </Field.Root>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`${name} を外す`}
                      onClick={() =>
                        onChange({
                          inputs: step.inputs.filter(
                            (item) =>
                              item.type !== "ingredient" ||
                              item.ingredientEntryId !== input.ingredientEntryId,
                          ),
                        })
                      }
                    >
                      <X />
                    </IconButton>
                  </Grid>
                </chakra.li>
              );
            })}
          </chakra.ul>
        ) : null}
        <Field.Root maxW={{ md: "20rem" }}>
          <Field.Label srOnly>{`手順${step.stepNumber} に材料を投入`}</Field.Label>
          <NativeSelect
            size="sm"
            placeholder={entries.length ? "材料を投入" : "材料がまだありません"}
            disabled={!entries.some((entry) => !used.has(entry.id))}
            options={entries
              .filter((entry) => !used.has(entry.id))
              .map((entry) => ({
                value: entry.id,
                label:
                  entry.label || entry.ingredientId
                    ? `${recipeEntryName(entry, ingredientById)} (${entry.displayAmount || "分量未入力"})`
                    : "材料未選択",
              }))}
            value=""
            onChange={(entryId) => {
              if (!entryId) return;
              onChange({
                inputs: [
                  ...step.inputs,
                  {
                    type: "ingredient",
                    ingredientEntryId: entryId,
                    amountRatio: remainingRatio(entryId),
                    amountText: null,
                  },
                ],
              });
            }}
          />
        </Field.Root>
      </Stack>

      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="5">
        <Stack gap="2">
          <Text textStyle="label" color="fg.muted">
            グループ
          </Text>
          <ToggleChips
            label={`手順${step.stepNumber} に投入するグループ`}
            options={groups.map((group) => ({
              value: group.id,
              label: `${group.symbol} ${group.label || "名称未設定"}`,
            }))}
            value={step.inputs.flatMap((input) => (input.type === "group" ? [input.groupId] : []))}
            onChange={(ids) =>
              onChange({
                inputs: [
                  ...others("group"),
                  ...ids.map((groupId) => ({ type: "group" as const, groupId })),
                ],
              })
            }
            emptyText="グループはありません"
          />
        </Stack>
        <Stack gap="2">
          <Text textStyle="label" color="fg.muted">
            中間生成物
          </Text>
          <ToggleChips
            label={`手順${step.stepNumber} に投入する中間生成物`}
            options={intermediateOptions}
            value={selectedIntermediates}
            onChange={(values) => {
              const refs = values.map((value) => {
                const [fromStepId, outputId] = value.split("::");
                return { type: "intermediate" as const, fromStepId, outputId };
              });
              // 参照元の手順を依存に加える (DAG の検証で必須)
              const deps = new Set(step.dependsOnStepIds);
              for (const ref of refs) deps.add(ref.fromStepId);
              onChange({
                inputs: [...others("intermediate"), ...refs],
                dependsOnStepIds: [...deps],
              });
            }}
            emptyText="他の手順に生成物がありません"
          />
        </Stack>
      </Grid>

      <Stack gap="2">
        <Text textStyle="label" color="fg.muted">
          生成物
        </Text>
        {step.outputs.length ? (
          <chakra.ul listStyleType="none" m="0" p="0" display="flex" flexDirection="column" gap="2">
            {step.outputs.map((output, index) => (
              <chakra.li key={output.id}>
                <Grid templateColumns="minmax(0, 1fr) auto" gap="2" maxW={{ md: "28rem" }}>
                  <Field.Root minW="0">
                    <Field.Label srOnly>{`生成物 ${index + 1}`}</Field.Label>
                    <Input
                      size="sm"
                      maxLength={120}
                      placeholder="炒めた玉ねぎ"
                      value={output.label}
                      onChange={(event) =>
                        onChange({
                          outputs: step.outputs.map((item) =>
                            item.id === output.id
                              ? { ...item, label: event.currentTarget.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field.Root>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={`生成物 ${index + 1} を削除`}
                    onClick={() =>
                      onChange({ outputs: step.outputs.filter((item) => item.id !== output.id) })
                    }
                  >
                    <X />
                  </IconButton>
                </Grid>
              </chakra.li>
            ))}
          </chakra.ul>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          alignSelf="start"
          onClick={() => onChange({ outputs: [...step.outputs, { id: makeId("out"), label: "" }] })}
        >
          <Plus />
          生成物を追加
        </Button>
      </Stack>
    </Stack>
  );
}
