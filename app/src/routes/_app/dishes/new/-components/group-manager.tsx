import { chakra, Field, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";

import { SubHeading } from "@/components/layout/section";
import { Button, IconButton } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { RecipeIngredientGroup } from "@/domain/recipe";

import { fieldIds, groupSymbols, type GroupSymbol } from "./recipe-draft";

export interface GroupManagerProps {
  groups: readonly RecipeIngredientGroup[];
  errors?: Readonly<Record<string, string>>;
  onChange(id: string, patch: Partial<Pick<RecipeIngredientGroup, "symbol" | "label">>): void;
  onRemove(id: string): void;
  onAdd(): void;
}

const symbolOptions = groupSymbols.map((symbol) => ({ value: symbol, label: symbol }));

/**
 * 材料グループ (★ 合わせ調味料など) の一覧。記号と名前を編集する。
 * 材料は各行のグループ欄から割り当てる。
 */
export function GroupManager({
  groups,
  errors = {},
  onChange,
  onRemove,
  onAdd,
}: GroupManagerProps) {
  return (
    <Stack gap="3" align="stretch">
      <SubHeading as="h3" trailing={groups.length ? `${groups.length}件` : undefined}>
        材料グループ
      </SubHeading>
      {groups.length ? (
        <chakra.ul listStyleType="none" m="0" p="0" display="flex" flexDirection="column" gap="2">
          {groups.map((group, index) => {
            const labelId = fieldIds.group(group.id);
            const name = group.label || `グループ${index + 1}`;
            return (
              <chakra.li key={group.id}>
                <Grid templateColumns="5rem minmax(0, 1fr) auto auto" gap="3" alignItems="start">
                  <Field.Root minW="0">
                    <Field.Label srOnly>{`${name} の記号`}</Field.Label>
                    <NativeSelect
                      size="sm"
                      options={symbolOptions}
                      value={group.symbol}
                      onChange={(value) => onChange(group.id, { symbol: value as GroupSymbol })}
                    />
                  </Field.Root>
                  <Field.Root
                    ids={{ control: labelId }}
                    minW="0"
                    invalid={Boolean(errors[labelId])}
                  >
                    <Field.Label srOnly>{`グループ${index + 1} の名前`}</Field.Label>
                    <Input
                      id={labelId}
                      size="sm"
                      maxLength={64}
                      placeholder="合わせ調味料"
                      value={group.label}
                      onChange={(event) => onChange(group.id, { label: event.currentTarget.value })}
                    />
                    {errors[labelId] ? <Field.ErrorText>{errors[labelId]}</Field.ErrorText> : null}
                  </Field.Root>
                  <Text
                    textStyle="caption"
                    color="fg.subtle"
                    lineHeight="32px"
                    whiteSpace="nowrap"
                    fontVariantNumeric="tabular-nums"
                  >
                    {group.ingredientEntryIds.length}品
                  </Text>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={`${name} を削除`}
                    onClick={() => onRemove(group.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </Grid>
              </chakra.li>
            );
          })}
        </chakra.ul>
      ) : null}
      <Button variant="ghost" size="sm" alignSelf="start" onClick={onAdd}>
        <Plus />
        グループを追加
      </Button>
    </Stack>
  );
}
