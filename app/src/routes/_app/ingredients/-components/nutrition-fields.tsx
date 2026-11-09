import { Grid, Input, Stack, Text } from "@chakra-ui/react";
import { Plus, Sparkles, Trash2 } from "lucide-react";

import { SubHeading } from "@/components/layout/section";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { NumberField } from "@/components/ui/number-field";

import type { MicroForm, MicroUnit, NutritionForm } from "./ingredient-form";

type MacroKey = Exclude<keyof NutritionForm, "micronutrients">;

const macroFields: readonly { key: MacroKey; label: string; unit: string; required: boolean }[] = [
  { key: "caloriesKcal", label: "エネルギー", unit: "kcal", required: true },
  { key: "proteinG", label: "たんぱく質", unit: "g", required: true },
  { key: "fatG", label: "脂質", unit: "g", required: true },
  { key: "carbohydrateG", label: "炭水化物", unit: "g", required: true },
  { key: "fiberG", label: "食物繊維", unit: "g", required: false },
  { key: "saltEquivalentG", label: "食塩相当量", unit: "g", required: false },
];

const microUnitOptions: readonly { value: MicroUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "mg", label: "mg" },
  { value: "ug", label: "µg" },
  { value: "kcal", label: "kcal" },
];

export interface NutritionFieldsProps {
  value: NutritionForm;
  onChange(value: NutritionForm): void;
  /** 見出しの補足 ("100g あたり")。 */
  basis: string;
  onEstimate?(): void;
  estimating?: boolean;
  /** 材料名が空のときなど、推定できない場合。 */
  estimateDisabled?: boolean;
}

/**
 * 基準量あたりの栄養価の入力欄。主要 6 項目と微量栄養素の行。
 */
export function NutritionFields({
  value,
  onChange,
  basis,
  onEstimate,
  estimating,
  estimateDisabled,
}: NutritionFieldsProps) {
  const setMacro = (key: MacroKey, next: string) => onChange({ ...value, [key]: next });
  const setMicros = (micronutrients: MicroForm[]) => onChange({ ...value, micronutrients });
  const updateMicro = (index: number, patch: Partial<MicroForm>) =>
    setMicros(
      value.micronutrients.map((micro, i) => (i === index ? { ...micro, ...patch } : micro)),
    );

  return (
    <Stack gap="5">
      <SubHeading
        trailing={
          onEstimate ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-label="AIで推定"
              onClick={onEstimate}
              loading={estimating}
              disabled={estimateDisabled}
            >
              <Sparkles />
              AIで推定
            </Button>
          ) : undefined
        }
      >
        {`栄養価（${basis}）`}
      </SubHeading>
      <Grid
        templateColumns={{ base: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" }}
        gap="4"
      >
        {macroFields.map((field) => (
          <NumberField
            key={field.key}
            label={field.label}
            unit={field.unit}
            min={0}
            step={0.1}
            required={field.required}
            value={value[field.key]}
            onChange={(next) => setMacro(field.key, next)}
          />
        ))}
      </Grid>
      <Stack gap="3">
        {value.micronutrients.length > 0 ? (
          <Text textStyle="label" color="fg.muted">
            微量栄養素
          </Text>
        ) : null}
        {value.micronutrients.map((micro, index) => (
          <Grid
            key={index}
            templateColumns={{
              base: "repeat(2, minmax(0, 1fr)) auto",
              sm: "minmax(0, 1fr) minmax(0, 1fr) 104px 88px auto",
            }}
            gap="3"
            alignItems="end"
            pb="3"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Field label="キー" required>
              <Input
                value={micro.key}
                maxLength={64}
                placeholder="vitaminC"
                onChange={(event) => updateMicro(index, { key: event.currentTarget.value })}
              />
            </Field>
            <Field label="表示名" required>
              <Input
                value={micro.label}
                maxLength={64}
                placeholder="ビタミンC"
                onChange={(event) => updateMicro(index, { label: event.currentTarget.value })}
              />
            </Field>
            <NumberField
              label="量"
              min={0}
              step={0.1}
              required
              value={micro.amount}
              onChange={(next) => updateMicro(index, { amount: next })}
            />
            <Field label="単位">
              <NativeSelect
                options={microUnitOptions}
                value={micro.unit}
                onChange={(next) => updateMicro(index, { unit: next as MicroUnit })}
              />
            </Field>
            <IconButton
              type="button"
              variant="ghost"
              aria-label={`${micro.label || `${index + 1}行目`}を削除`}
              gridColumn={{ base: "3", sm: "5" }}
              gridRow="1"
              onClick={() => setMicros(value.micronutrients.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </IconButton>
          </Grid>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          alignSelf="flex-start"
          ms="-3"
          onClick={() =>
            setMicros([...value.micronutrients, { key: "", label: "", amount: "0", unit: "mg" }])
          }
        >
          <Plus />
          微量栄養素を追加
        </Button>
      </Stack>
    </Stack>
  );
}
