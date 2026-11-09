import { Grid, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { Field } from "@/components/ui/field";

import { DraftNumberInput } from "./draft-number-input";
import { fieldIds, type DishFields } from "./recipe-draft";
import { TagInput } from "./tag-input";

export interface BasicInfoProps extends DishFields {
  summary: string | null;
  equipment: readonly string[];
  errors?: Readonly<Record<string, string>>;
  /** 表紙画像の入力 (ImageUpload)。 */
  cover?: ReactNode;
  onFieldsChange(patch: Partial<DishFields>): void;
  onSummaryChange(summary: string | null): void;
  onEquipmentChange(equipment: string[]): void;
}

/** 表紙画像・料理名・カテゴリ・人前・概要・器具。 */
export function BasicInfo({
  name,
  category,
  servings,
  summary,
  equipment,
  errors = {},
  cover,
  onFieldsChange,
  onSummaryChange,
  onEquipmentChange,
}: BasicInfoProps) {
  return (
    <Stack gap="5">
      {cover ? (
        <Stack gap="1.5" role="group" aria-labelledby="recipe-cover-label" maxW="480px">
          <Text id="recipe-cover-label" textStyle="label" color="fg">
            表紙画像
          </Text>
          {cover}
        </Stack>
      ) : null}
      <Grid
        templateColumns={{ base: "1fr 1fr", md: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" }}
        gap="4"
      >
        <Stack gridColumn={{ base: "1 / -1", md: "auto" }}>
          <Field label="料理名" required id={fieldIds.name} errorText={errors[fieldIds.name]}>
            <Input
              maxLength={120}
              value={name}
              placeholder="ポークカレー"
              onChange={(event) => onFieldsChange({ name: event.currentTarget.value })}
            />
          </Field>
        </Stack>
        <Field label="カテゴリ">
          <Input
            maxLength={64}
            value={category}
            placeholder="主菜"
            onChange={(event) => onFieldsChange({ category: event.currentTarget.value })}
          />
        </Field>
        <Field label="人前" required id={fieldIds.servings} errorText={errors[fieldIds.servings]}>
          <DraftNumberInput
            unit="人前"
            value={servings.trim() === "" ? null : Number(servings)}
            invalid={Boolean(errors[fieldIds.servings])}
            onChange={(value) => onFieldsChange({ servings: value === null ? "" : String(value) })}
          />
        </Field>
      </Grid>
      <Field label="概要">
        <Textarea
          maxLength={500}
          rows={3}
          value={summary ?? ""}
          onChange={(event) => onSummaryChange(event.currentTarget.value || null)}
        />
      </Field>
      <Field label="器具" helperText="Enter または読点で区切る">
        <TagInput
          value={equipment}
          onChange={onEquipmentChange}
          placeholder="鍋、包丁、まな板"
          maxLength={100}
        />
      </Field>
    </Stack>
  );
}
