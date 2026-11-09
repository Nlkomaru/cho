import { Box, chakra, Field, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { RecipeIngredientEntry, RecipeIngredientGroup } from "@/domain/recipe";

import { DraftNumberInput } from "./draft-number-input";
import { entryLabel, fieldIds, roleOptions, type IngredientOption } from "./recipe-draft";

export interface IngredientRowsProps {
  entries: readonly RecipeIngredientEntry[];
  groups: readonly RecipeIngredientGroup[];
  /** 材料マスタ。 */
  ingredients: readonly IngredientOption[];
  errors?: Readonly<Record<string, string>>;
  onChange(id: string, patch: Partial<RecipeIngredientEntry>): void;
  onRemove(id: string): void;
  onAdd(): void;
}

const columns = {
  base: "minmax(0, 1fr) minmax(0, 1fr)",
  md: "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.1fr) 2.5rem",
};

// md 以上は見出し行があるので各欄のラベルを視覚的に隠す
const cellLabelCss = {
  textStyle: "label",
  color: "fg.muted",
  mb: "1.5",
  md: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
  },
} as const;

function Cell({
  id,
  label,
  error,
  span,
  children,
}: {
  /** 中の入力要素の id (ラベルと結び付ける)。 */
  id?: string;
  label: string;
  error?: string;
  span?: boolean;
  children: ReactNode;
}) {
  return (
    <Field.Root
      ids={id ? { control: id } : undefined}
      invalid={Boolean(error)}
      minW="0"
      gridColumn={span ? { base: "1 / -1", md: "auto" } : undefined}
    >
      <Field.Label css={cellLabelCss}>{label}</Field.Label>
      {children}
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
    </Field.Root>
  );
}

/**
 * 材料の編集行。材料マスタ・基準量・表示分量・グループを 1 行に、役割・表記・下ごしらえを 2 行目に置く。
 * 材料名は材料マスタから引く。表記はこのレシピだけの言い方を付けたいときに入れる。
 */
export function IngredientRows({
  entries,
  groups,
  ingredients,
  errors = {},
  onChange,
  onRemove,
  onAdd,
}: IngredientRowsProps) {
  const ingredientById = useMemo(
    () => new Map(ingredients.map((item) => [item.id, item])),
    [ingredients],
  );
  const ingredientOptions = ingredients.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.baseUnit})`,
  }));
  const groupOptions = groups.map((group) => ({
    value: group.id,
    label: `${group.symbol} ${group.label || "名称未設定"}`,
  }));

  return (
    <Stack gap="4" align="stretch">
      {entries.length ? (
        <Box>
          <Grid
            aria-hidden="true"
            display={{ base: "none", md: "grid" }}
            templateColumns={columns.md}
            gap="3"
            pb="2"
            borderBottomWidth="1px"
            borderColor="navy.900"
            textStyle="label"
            color="fg.muted"
          >
            <Text>材料</Text>
            <Text>基準量</Text>
            <Text>表示分量</Text>
            <Text>グループ</Text>
            <span />
          </Grid>
          <chakra.ol listStyleType="none" m="0" p="0">
            {entries.map((entry, index) => {
              const master = ingredientById.get(entry.ingredientId);
              const rowName = entryLabel(entry, index, ingredientById);
              const ingredientId = fieldIds.entry(entry.id, "ingredient");
              const amountId = fieldIds.entry(entry.id, "amount");
              const displayId = fieldIds.entry(entry.id, "display");
              return (
                <chakra.li
                  key={entry.id}
                  py="3"
                  borderBottomWidth="1px"
                  borderColor="border"
                  display="flex"
                  flexDirection="column"
                  gap="2.5"
                >
                  <Grid templateColumns={columns} gap="3" alignItems="start">
                    <Cell id={ingredientId} label="材料" error={errors[ingredientId]} span>
                      <NativeSelect
                        id={ingredientId}
                        options={ingredientOptions}
                        placeholder="材料を選択"
                        value={entry.ingredientId}
                        onChange={(value) => {
                          const item = ingredientById.get(value);
                          onChange(entry.id, { ingredientId: value, unit: item?.baseUnit ?? "" });
                        }}
                      />
                    </Cell>
                    <Cell id={amountId} label="基準量" error={errors[amountId]}>
                      <DraftNumberInput
                        id={amountId}
                        unit={entry.unit || master?.baseUnit || undefined}
                        value={entry.amount > 0 ? entry.amount : null}
                        invalid={Boolean(errors[amountId])}
                        onChange={(value) => onChange(entry.id, { amount: value ?? 0 })}
                      />
                    </Cell>
                    <Cell id={displayId} label="表示分量" error={errors[displayId]}>
                      <Input
                        id={displayId}
                        maxLength={64}
                        placeholder="大さじ1"
                        value={entry.displayAmount}
                        onChange={(event) =>
                          onChange(entry.id, { displayAmount: event.currentTarget.value })
                        }
                      />
                    </Cell>
                    <Cell label="グループ">
                      <NativeSelect
                        options={groupOptions}
                        placeholder="なし"
                        value={entry.groupId ?? ""}
                        onChange={(value) => onChange(entry.id, { groupId: value || null })}
                      />
                    </Cell>
                    <Box
                      display="flex"
                      alignItems="flex-end"
                      alignSelf={{ base: "end", md: "start" }}
                      justifyContent={{ base: "flex-end", md: "center" }}
                    >
                      <IconButton
                        variant="ghost"
                        aria-label={`${rowName} を削除`}
                        onClick={() => onRemove(entry.id)}
                      >
                        <Trash2 />
                      </IconButton>
                    </Box>
                  </Grid>
                  <Grid
                    templateColumns={{
                      base: "minmax(0, 1fr) minmax(0, 1fr)",
                      md: "minmax(0, 9rem) minmax(0, 1fr) minmax(0, 1fr)",
                    }}
                    gap="3"
                    pe={{ md: "calc(2.5rem + {spacing.3})" }}
                  >
                    <Field.Root minW="0">
                      <Field.Label srOnly>{`${rowName} の役割`}</Field.Label>
                      <NativeSelect
                        size="sm"
                        options={roleOptions}
                        value={entry.role}
                        onChange={(value) =>
                          onChange(entry.id, { role: value as RecipeIngredientEntry["role"] })
                        }
                      />
                    </Field.Root>
                    <Field.Root minW="0">
                      <Field.Label srOnly>{`${rowName} のレシピ内の表記`}</Field.Label>
                      <Input
                        size="sm"
                        maxLength={120}
                        placeholder={master ? `表記 (${master.name})` : "表記"}
                        value={entry.label ?? ""}
                        onChange={(event) => {
                          const label = event.currentTarget.value;
                          onChange(entry.id, { label: label.trim() ? label : null });
                        }}
                      />
                    </Field.Root>
                    <Field.Root minW="0" gridColumn={{ base: "1 / -1", md: "auto" }}>
                      <Field.Label srOnly>{`${rowName} の下ごしらえ`}</Field.Label>
                      <Input
                        size="sm"
                        maxLength={120}
                        placeholder="下ごしらえ"
                        value={entry.prepNote ?? ""}
                        onChange={(event) =>
                          onChange(entry.id, { prepNote: event.currentTarget.value || null })
                        }
                      />
                    </Field.Root>
                  </Grid>
                </chakra.li>
              );
            })}
          </chakra.ol>
        </Box>
      ) : null}
      <Button
        id={fieldIds.ingredients}
        variant="outline"
        size="sm"
        alignSelf="start"
        onClick={onAdd}
      >
        <Plus />
        材料を追加
      </Button>
      {errors[fieldIds.ingredients] ? (
        <Text textStyle="body.sm" color="fg.error">
          {errors[fieldIds.ingredients]}
        </Text>
      ) : null}
    </Stack>
  );
}
