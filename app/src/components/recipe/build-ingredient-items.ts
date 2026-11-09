import {
  calculateIngredientCost,
  calculateIngredientNutrition,
  type Ingredient,
} from "@/domain/ingredient";
import { sumNutritionFacts, type NutritionFacts } from "@/domain/nutrition";
import type { RecipeIngredientEntry, RecipeJson, RecipeStep } from "@/domain/recipe";
import { formatNumber } from "@/lib/format";

import type { IngredientListGroup, IngredientListItem } from "./ingredient-list";

type RecipeSource = Pick<RecipeJson, "ingredients" | "ingredientGroups" | "steps">;

// 1/2・1/3・1/4 で表せる値は分数にする (計量スプーンや個数で量れる刻み)
const FRACTION_DENOMINATORS = [2, 3, 4] as const;
const FRACTION_TOLERANCE = 0.02;

/** 換算後の数値を読みやすく丸める。丸めで値が変わったときは approximate を立てる。 */
function formatScaledValue(value: number): { text: string; approximate: boolean } {
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < 1e-6) return { text: String(whole), approximate: false };
  if (1 - rest < 1e-6) return { text: String(whole + 1), approximate: false };
  if (value < 10) {
    for (const denominator of FRACTION_DENOMINATORS) {
      const numerator = Math.round(rest * denominator);
      const error = Math.abs(rest - numerator / denominator);
      if (numerator > 0 && numerator < denominator && error < FRACTION_TOLERANCE) {
        const fraction = `${numerator}/${denominator}`;
        return {
          text: whole > 0 ? `${whole}と${fraction}` : fraction,
          approximate: error > 1e-6,
        };
      }
    }
    const rounded = Math.round(value * 10) / 10;
    return { text: String(rounded), approximate: Math.abs(rounded - value) > 1e-6 };
  }
  const rounded = Math.round(value);
  return { text: String(rounded), approximate: Math.abs(rounded - value) >= 0.05 * value };
}

/**
 * 表示分量 ("2個"、"小さじ1/3 (2g)") の数値部分を倍率で換算する。
 * 端数は分数 ("大さじ1と1/4") か小数 1 桁に丸め、丸めたときは先頭に "約" を付ける。
 * 数値を含まない表示 ("適量") は基準量と単位から作り直す。
 */
export function scaleDisplayAmount(
  entry: Pick<RecipeIngredientEntry, "amount" | "unit" | "displayAmount">,
  factor: number,
): string {
  if (Math.abs(factor - 1) < 1e-9) return entry.displayAmount;
  let approximate = false;
  const scaled = entry.displayAmount.replace(
    /(\d+(?:\.\d+)?)(?:\/(\d+))?/g,
    (_, numerator: string, denominator: string | undefined) => {
      const value = denominator
        ? (Number(numerator) / Number(denominator)) * factor
        : Number(numerator) * factor;
      const formatted = formatScaledValue(value);
      approximate ||= formatted.approximate;
      return formatted.text;
    },
  );
  if (scaled === entry.displayAmount) return `${formatNumber(entry.amount * factor)}${entry.unit}`;
  return approximate && !scaled.startsWith("約") ? `約${scaled}` : scaled;
}

/** 材料グループ ("★ 隠し味") の一覧。 */
export function buildIngredientGroups(recipe: Pick<RecipeJson, "ingredientGroups">) {
  return recipe.ingredientGroups.map((group): IngredientListGroup => ({
    key: group.id,
    label: `${group.symbol} ${group.label}`,
  }));
}

interface IngredientUsage {
  step: RecipeStep;
  ratio: number;
  amountText: string | null;
}

function usagesOf(entry: RecipeIngredientEntry, recipe: RecipeSource): IngredientUsage[] {
  return recipe.steps.flatMap((step) =>
    step.inputs.flatMap((input): IngredientUsage[] => {
      if (input.type === "ingredient" && input.ingredientEntryId === entry.id)
        return [{ step, ratio: input.amountRatio, amountText: input.amountText }];
      if (
        input.type === "group" &&
        recipe.ingredientGroups
          .find((group) => group.id === input.groupId)
          ?.ingredientEntryIds.includes(entry.id)
      )
        return [{ step, ratio: 1, amountText: null }];
      return [];
    }),
  );
}

/**
 * 材料表の行を作る。分量・栄養価・原価は人前の倍率 `scale` で換算する。
 */
export function buildIngredientItems(
  recipe: RecipeSource,
  options: { scale: number; ingredientById?: ReadonlyMap<string, Ingredient> },
): IngredientListItem[] {
  const { scale, ingredientById } = options;
  return recipe.ingredients.map((entry) => {
    const ingredient = ingredientById?.get(entry.ingredientId);
    const amount = entry.amount * scale;
    return {
      id: entry.id,
      name: entry.name,
      amount: scaleDisplayAmount(entry, scale),
      prep: entry.prepNote,
      groupKey: entry.groupId,
      usages: usagesOf(entry, recipe)
        .sort((a, b) => a.step.stepNumber - b.step.stepNumber)
        .map((usage) => ({
          stepId: usage.step.id,
          stepNumber: usage.step.stepNumber,
          amount: usage.amountText ?? scaleDisplayAmount(entry, scale * usage.ratio),
        })),
      facts: ingredient ? calculateIngredientNutrition(ingredient, amount) : null,
      costYen: ingredient ? calculateIngredientCost(ingredient, amount) : null,
    };
  });
}

/**
 * 材料の合計。1 つでも栄養価・単価が無い材料があれば null。
 */
export function sumIngredientItems(items: readonly IngredientListItem[]): {
  facts: NutritionFacts | null;
  costYen: number | null;
} {
  const facts = items.map((item) => item.facts ?? null);
  const costs = items.map((item) => item.costYen ?? null);
  return {
    facts:
      facts.length > 0 && facts.every((fact) => fact !== null)
        ? sumNutritionFacts(facts as NutritionFacts[])
        : null,
    costYen:
      costs.length > 0 && costs.every((cost) => cost !== null)
        ? (costs as number[]).reduce((sum, cost) => sum + cost, 0)
        : null,
  };
}

export interface StepInputLine {
  key: string;
  name: string;
  amount?: string;
}

/**
 * 手順の「投入」に並べる材料・グループ・中間生成物。
 */
export function describeStepInputs(
  step: RecipeStep,
  recipe: RecipeSource,
  scale: number,
): StepInputLine[] {
  return step.inputs.map((input, index): StepInputLine => {
    if (input.type === "ingredient") {
      const entry = recipe.ingredients.find((item) => item.id === input.ingredientEntryId);
      if (!entry) return { key: `i-${index}`, name: input.ingredientEntryId };
      return {
        key: `i-${index}`,
        name: entry.name,
        amount: input.amountText ?? scaleDisplayAmount(entry, scale * input.amountRatio),
      };
    }
    if (input.type === "group") {
      const group = recipe.ingredientGroups.find((item) => item.id === input.groupId);
      if (!group) return { key: `g-${index}`, name: input.groupId };
      const members = group.ingredientEntryIds
        .map((id) => recipe.ingredients.find((item) => item.id === id))
        .filter((entry): entry is RecipeIngredientEntry => Boolean(entry))
        .map((entry) => `${entry.name} ${scaleDisplayAmount(entry, scale)}`);
      return {
        key: `g-${index}`,
        name: `${group.symbol} ${group.label}`,
        amount: members.length ? `（${members.join("、")}）` : undefined,
      };
    }
    const source = recipe.steps.find((item) => item.id === input.fromStepId);
    const label = source?.outputs.find((output) => output.id === input.outputId)?.label;
    return {
      key: `m-${index}`,
      name: label ?? input.outputId,
      amount: source ? `（手順${source.stepNumber}）` : undefined,
    };
  });
}
