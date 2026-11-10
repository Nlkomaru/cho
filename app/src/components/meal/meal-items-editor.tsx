import { Box, Collapsible, Flex, Input, SimpleGrid, chakra } from "@chakra-ui/react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { NutritionInline } from "@/components/food/nutrition-inline";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { NumberField } from "@/components/ui/number-field";
import type { NutritionFacts } from "@/domain/nutrition";

import { dishMealItem, emptyFacts, type Dish, type MealItem } from "./meal-shared";

type FactKey = Exclude<keyof NutritionFacts, "micronutrients">;

const factFields: { key: FactKey; label: string; unit: string }[] = [
  { key: "caloriesKcal", label: "エネルギー", unit: "kcal" },
  { key: "proteinG", label: "たんぱく質", unit: "g" },
  { key: "fatG", label: "脂質", unit: "g" },
  { key: "carbohydrateG", label: "炭水化物", unit: "g" },
  { key: "fiberG", label: "食物繊維", unit: "g" },
  { key: "saltEquivalentG", label: "食塩相当量", unit: "g" },
];

export const blankMealItem = (): MealItem => ({ name: "", priceYen: null, nutrition: null });

const sourceLabel: Partial<Record<NonNullable<MealItem["estimationSource"]>, string>> = {
  ingredient: "材料から",
  ai: "AI推定",
};

export interface MealItemsEditorProps {
  items: readonly MealItem[];
  onChange(items: MealItem[]): void;
  disabled?: boolean;
  /** 品目を丸ごと差し替えたとき (AI 解析など) に変えると、入力途中の栄養価を捨てる。 */
  resetKey?: number;
  /** 渡すと品目ごとにレシピをつなげる。 */
  dishes?: readonly Dish[];
}

/**
 * 品目の編集。品目名と料金を並べ、レシピとのつながりと栄養価をその下に置く。
 */
export function MealItemsEditor({
  items,
  onChange,
  disabled,
  resetKey = 0,
  dishes,
}: MealItemsEditorProps) {
  // 途中の品目を消すと位置がずれるので、そのときも入力途中の値を捨てる
  const [removals, setRemovals] = useState(0);
  const dishOptions = useMemo(
    () => (dishes ?? []).map((dish) => ({ value: dish.id, label: dish.name })),
    [dishes],
  );
  const replace = (index: number, next: MealItem) =>
    onChange(items.map((item, i) => (i === index ? next : item)));
  const update = (index: number, patch: Partial<MealItem>) => {
    const manual = "priceYen" in patch || "nutrition" in patch;
    replace(index, {
      ...items[index],
      ...patch,
      ...(manual ? { estimationSource: "manual" as const } : {}),
    });
  };
  const link = (index: number, dishId: string, factor: number) => {
    const item = items[index];
    const dish = dishes?.find((entry) => entry.id === dishId);
    if (!dish) {
      // つながりだけ外し、料金と栄養価は手入力の値として残す
      replace(index, { ...item, dishId: null, estimationSource: "manual" });
      return;
    }
    const linked = dishMealItem(dish, factor);
    const previous = item.dishId ? dishes?.find((entry) => entry.id === item.dishId) : undefined;
    // 自分で付けた品目名は残し、空かレシピ名のままなら新しいレシピ名にする
    const keepName = item.name.trim() !== "" && item.name !== previous?.name;
    // 手で入れた料金は残し、料金が無いときだけレシピの原価を使う
    const keepPrice = !item.dishId && item.priceYen !== null;
    replace(index, {
      ...item,
      ...linked,
      name: keepName ? item.name : linked.name,
      ...(keepPrice ? { priceYen: item.priceYen, estimationSource: "manual" as const } : {}),
    });
  };

  return (
    <chakra.ol listStyle="none" m="0" p="0">
      {items.map((item, index) => (
        <chakra.li
          // 品目は並べ替えないので位置をキーにする
          key={`${resetKey}-${removals}-${index}`}
          py="4"
          borderTopWidth="1px"
          borderColor="border"
          _first={{ pt: "0", borderTopWidth: "0" }}
        >
          <Flex gap="3" align="flex-end">
            <Box flex="1" minW="0">
              <Field label={`品目 ${index + 1}`} required={index === 0}>
                <Input
                  value={item.name}
                  disabled={disabled}
                  onChange={(event) => update(index, { name: event.currentTarget.value })}
                />
              </Field>
            </Box>
            <Box w="32" flexShrink="0">
              <NumberField
                label="料金"
                unit="円"
                value={item.priceYen === null ? "" : String(item.priceYen)}
                min={0}
                step={1}
                disabled={disabled}
                onChange={(value) =>
                  update(index, { priceYen: value === "" ? null : Number(value) })
                }
              />
            </Box>
            <IconButton
              aria-label={`品目 ${index + 1} を削除`}
              variant="ghost"
              size="md"
              disabled={disabled}
              onClick={() => {
                setRemovals((count) => count + 1);
                onChange(items.filter((_, position) => position !== index));
              }}
            >
              <Trash2 strokeWidth={1.75} />
            </IconButton>
          </Flex>
          {dishes && !item.ingredientId ? (
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3" mt="3">
              <Box gridColumn={{ sm: "span 2" }}>
                <Field label="レシピ">
                  <NativeSelect
                    size="sm"
                    value={item.dishId ?? ""}
                    placeholder={dishes.length ? "つながない" : "レシピがありません"}
                    options={dishOptions}
                    disabled={disabled}
                    onChange={(value) => link(index, value, item.servingsFactor ?? 1)}
                  />
                </Field>
              </Box>
              {item.dishId ? (
                <NumberField
                  label="人前数"
                  unit="人前"
                  size="sm"
                  value={String(item.servingsFactor ?? 1)}
                  min={0.1}
                  step={0.5}
                  disabled={disabled}
                  onChange={(value) => {
                    const factor = Number(value);
                    if (item.dishId && factor > 0) link(index, item.dishId, factor);
                  }}
                />
              ) : null}
            </SimpleGrid>
          ) : item.estimationSource && sourceLabel[item.estimationSource] ? (
            <chakra.p textStyle="caption" color="fg.subtle" mt="2">
              {sourceLabel[item.estimationSource]}
            </chakra.p>
          ) : null}
          <NutritionEditor
            // レシピや人前数を変えたら入力欄を新しい栄養価で作り直す
            key={`${item.dishId ?? ""}:${item.servingsFactor ?? 1}`}
            value={item.nutrition}
            disabled={disabled}
            onChange={(nutrition) => update(index, { nutrition })}
          />
        </chakra.li>
      ))}
    </chakra.ol>
  );
}

function NutritionEditor({
  value,
  onChange,
  disabled,
}: {
  value: NutritionFacts | null;
  onChange(nutrition: NutritionFacts): void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<Record<FactKey, string>>(() => ({
    caloriesKcal: value ? String(value.caloriesKcal) : "",
    proteinG: value ? String(value.proteinG) : "",
    fatG: value ? String(value.fatG) : "",
    carbohydrateG: value ? String(value.carbohydrateG) : "",
    fiberG: value?.fiberG == null ? "" : String(value.fiberG),
    saltEquivalentG: value?.saltEquivalentG == null ? "" : String(value.saltEquivalentG),
  }));

  const update = (key: FactKey, next: string) => {
    setDraft((current) => ({ ...current, [key]: next }));
    const base = value ?? emptyFacts();
    const nullable = key === "fiberG" || key === "saltEquivalentG";
    onChange({ ...base, [key]: next === "" ? (nullable ? null : 0) : Number(next) });
  };

  return (
    <Collapsible.Root mt="2">
      <Flex align="center" gap="3" wrap="wrap">
        <Collapsible.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            ms="-3"
            css={{ "&[data-state=open] svg": { transform: "rotate(180deg)" } }}
          >
            栄養価
            <ChevronDown strokeWidth={1.75} />
          </Button>
        </Collapsible.Trigger>
        <NutritionInline facts={value} size="xs" />
      </Flex>
      <Collapsible.Content>
        <SimpleGrid columns={{ base: 2, sm: 3 }} gap="3" pt="3">
          {factFields.map(({ key, label, unit }) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              size="sm"
              value={draft[key]}
              min={0}
              step={0.1}
              disabled={disabled}
              onChange={(next) => update(key, next)}
            />
          ))}
        </SimpleGrid>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
