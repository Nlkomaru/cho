import { Box, Grid, Input, Stack, Textarea } from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";

import {
  cautionCategoryOptions,
  emptyCaution,
  fieldIds,
  severityOptions,
  type RecipeCaution,
} from "./recipe-draft";

export interface CautionEditorProps {
  caution: RecipeCaution;
  /** 読み上げ用の番号 ("注意 1")。 */
  index: number;
  errors?: Readonly<Record<string, string>>;
  onChange(caution: RecipeCaution): void;
  onRemove(): void;
}

/**
 * 注意事項 1 件の入力。種類・重大度・見出し・発生条件・説明。
 */
export function CautionEditor({
  caution,
  index,
  errors = {},
  onChange,
  onRemove,
}: CautionEditorProps) {
  const set = (patch: Partial<RecipeCaution>) => onChange({ ...caution, ...patch });
  const titleId = fieldIds.caution(caution.id, "title");
  const descriptionId = fieldIds.caution(caution.id, "description");
  return (
    <Box as="li" listStyleType="none" bg="bg.subtle" p={{ base: "4", md: "5" }}>
      <Stack gap="4">
        <Grid
          templateColumns={{
            base: "1fr 1fr",
            md: "repeat(2, minmax(0, 9rem)) minmax(0, 1fr) auto",
          }}
          gap="4"
          alignItems="end"
        >
          <Field label="種類">
            <NativeSelect
              options={cautionCategoryOptions}
              value={caution.category}
              onChange={(value) => set({ category: value as RecipeCaution["category"] })}
            />
          </Field>
          <Field label="重大度">
            <NativeSelect
              options={severityOptions}
              value={caution.severity}
              onChange={(value) => set({ severity: value as RecipeCaution["severity"] })}
            />
          </Field>
          <Box gridColumn={{ base: "1 / -1", md: "auto" }}>
            <Field label="見出し" required id={titleId} errorText={errors[titleId]}>
              <Input
                maxLength={120}
                value={caution.title}
                placeholder="生焼けに注意"
                onChange={(event) => set({ title: event.currentTarget.value })}
              />
            </Field>
          </Box>
          <IconButton
            variant="ghost"
            aria-label={`注意 ${index + 1} を削除`}
            onClick={onRemove}
            display={{ base: "none", md: "inline-flex" }}
          >
            <Trash2 />
          </IconButton>
        </Grid>
        <Field label="発生条件">
          <Input
            maxLength={200}
            value={caution.triggerCondition ?? ""}
            placeholder="厚みが 2cm を超えるとき"
            onChange={(event) => set({ triggerCondition: event.currentTarget.value || null })}
          />
        </Field>
        <Field label="説明" required id={descriptionId} errorText={errors[descriptionId]}>
          <Textarea
            maxLength={1000}
            rows={3}
            value={caution.description}
            onChange={(event) => set({ description: event.currentTarget.value })}
          />
        </Field>
        <Button
          variant="danger"
          size="sm"
          alignSelf="start"
          onClick={onRemove}
          display={{ base: "inline-flex", md: "none" }}
        >
          <Trash2 />
          注意を削除
        </Button>
      </Stack>
    </Box>
  );
}

export interface CautionListProps {
  cautions: readonly RecipeCaution[];
  errors?: Readonly<Record<string, string>>;
  onChange(cautions: RecipeCaution[]): void;
  addLabel?: string;
}

/** 注意事項の一覧と追加ボタン。 */
export function CautionList({
  cautions,
  errors,
  onChange,
  addLabel = "注意を追加",
}: CautionListProps) {
  return (
    <Stack gap="3" align="stretch">
      {cautions.length ? (
        <Stack as="ul" gap="2" m="0" p="0">
          {cautions.map((caution, index) => (
            <CautionEditor
              key={caution.id}
              caution={caution}
              index={index}
              errors={errors}
              onChange={(next) =>
                onChange(cautions.map((item) => (item.id === caution.id ? next : item)))
              }
              onRemove={() => onChange(cautions.filter((item) => item.id !== caution.id))}
            />
          ))}
        </Stack>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        alignSelf="start"
        onClick={() => onChange([...cautions, emptyCaution()])}
      >
        <Plus />
        {addLabel}
      </Button>
    </Stack>
  );
}
