import type { Dish } from "./ingredient";
import type { RecipeJson, RecipeStep, RecipeIngredientEntry } from "./recipe";
import { validateRecipeDag } from "./recipe-scheduler";

export interface SimplifiedIngredient {
  name: string;
  amount: number;
  unit: string;
  displayAmount?: string;
  role?: "main" | "seasoning" | "topping" | "optional";
  prepNote?: string;
}

export interface SimplifiedPhase {
  instruction: string;
  durationSec?: number;
  heatLevel?: string;
  ingredients: string[];
}

export interface SimplifiedRecipe {
  name: string;
  category?: string;
  servings: number;
  summary?: string;
  equipment?: string[];
  ingredients: SimplifiedIngredient[];
  phases?: {
    prep?: SimplifiedPhase;
    cook?: SimplifiedPhase;
    assemble?: SimplifiedPhase;
    finish?: SimplifiedPhase;
  };
}

export interface ConvertInventiaToChoResult {
  dishPayload: Omit<Dish, "id"> & { id?: string };
  warnings: string[];
}

type HeatLevel =
  | "none"
  | "low"
  | "medium_low"
  | "medium"
  | "medium_high"
  | "high"
  | "boil"
  | "simmer";

const VALID_HEAT_LEVELS: readonly HeatLevel[] = [
  "none",
  "low",
  "medium_low",
  "medium",
  "medium_high",
  "high",
  "boil",
  "simmer",
] as const;

function normalizeHeatLevel(raw: string | undefined, defaultLevel: HeatLevel): HeatLevel {
  if (!raw) return defaultLevel;
  const s = raw.toLowerCase().trim().replace(/[- ]/g, "_");
  if (VALID_HEAT_LEVELS.includes(s as HeatLevel)) {
    return s as HeatLevel;
  }
  return defaultLevel;
}

/**
 * Converts a simplified/Inventia recipe definition into a valid cho recipe payload
 * adhering to `dishSchema` and `recipeSchema`.
 *
 * - Maps ingredient names / Inventia item IDs to cho's internal `ingredientId`
 * - Auto-generates standard 4-phase steps (prep, cook, assemble, finish) with DAG dependencies
 * - Performs pre-flight dry-run validation with `validateRecipeDag` to guarantee zero DAG errors
 */
export function convertInventiaToCho(
  recipe: SimplifiedRecipe,
  ingredientMap: Record<string, string> = {},
): ConvertInventiaToChoResult {
  const warnings: string[] = [];
  const servings = Math.max(1, Math.min(100, Math.round(recipe.servings || 1)));

  // 1. Convert ingredients
  const convertedIngredients: RecipeIngredientEntry[] = [];
  const ingredientMapByName = new Map<string, RecipeIngredientEntry>();

  recipe.ingredients.forEach((ing, index) => {
    const entryId = `entry-${index + 1}`;
    const trimmedName = ing.name.trim();

    // Lookup in ingredient map (support name or optional id)
    let ingredientId = ingredientMap[trimmedName] ?? ingredientMap[ing.name];
    if (!ingredientId && (ing as Record<string, unknown>).id) {
      const rawId = String((ing as Record<string, unknown>).id);
      ingredientId = ingredientMap[rawId];
    }

    if (!ingredientId || ingredientId.trim() === "") {
      warnings.push(`Ingredient "${ing.name}" not found in ingredientMap; using placeholder id.`);
      ingredientId = `unmapped-${index + 1}`;
    }

    const entry: RecipeIngredientEntry = {
      id: entryId,
      ingredientId,
      name: trimmedName,
      amount: Math.max(0.001, Number(ing.amount) || 1),
      unit: ing.unit.trim() || "g",
      displayAmount: (ing.displayAmount ?? `${ing.amount}${ing.unit}`).trim(),
      role: ing.role ?? "main",
      groupId: null,
      prepNote: ing.prepNote?.trim() ?? null,
    };

    convertedIngredients.push(entry);
    ingredientMapByName.set(trimmedName, entry);
    ingredientMapByName.set(ing.name, entry);
  });

  // 2. Synthesize 4 standard phases: prep, cook, assemble, finish
  const phaseOrder = ["prep", "cook", "assemble", "finish"] as const;
  const phaseMeta = {
    prep: {
      stepNumber: 1,
      title: "下準備",
      defaultInstruction: "食材を計量し、必要な下ごしらえを行う。",
      defaultDuration: 300,
      defaultHeat: "none" as HeatLevel,
      outputId: "out-prep",
      outputLabel: "下処理済み具材",
      dependsOn: [] as string[],
      intermediateFrom: null as { fromStepId: string; outputId: string } | null,
    },
    cook: {
      stepNumber: 2,
      title: "加熱調理",
      defaultInstruction: "具材を加熱調理する。",
      defaultDuration: 420,
      defaultHeat: "medium" as HeatLevel,
      outputId: "out-cook",
      outputLabel: "調理済み具材",
      dependsOn: ["step-prep"],
      intermediateFrom: { fromStepId: "step-prep", outputId: "out-prep" },
    },
    assemble: {
      stepNumber: 3,
      title: "組み立て・盛り付け",
      defaultInstruction: "調理した具材を合わせ、盛り付ける。",
      defaultDuration: 180,
      defaultHeat: "none" as HeatLevel,
      outputId: "out-assemble",
      outputLabel: "組み立て済み具材",
      dependsOn: ["step-cook"],
      intermediateFrom: { fromStepId: "step-cook", outputId: "out-cook" },
    },
    finish: {
      stepNumber: 4,
      title: "仕上げ",
      defaultInstruction: "最終加熱またはトッピングで仕上げる。",
      defaultDuration: 300,
      defaultHeat: "high" as HeatLevel,
      outputId: "out-finish",
      outputLabel: "完成品",
      dependsOn: ["step-assemble"],
      intermediateFrom: { fromStepId: "step-assemble", outputId: "out-assemble" },
    },
  };

  const assignedIngredientEntryIds = new Set<string>();
  const phaseIngredientInputs: Record<
    (typeof phaseOrder)[number],
    Array<{
      type: "ingredient";
      ingredientEntryId: string;
      amountRatio: number;
      amountText: null;
    }>
  > = {
    prep: [],
    cook: [],
    assemble: [],
    finish: [],
  };

  // Assign ingredients listed in recipe.phases
  if (recipe.phases) {
    for (const phaseKey of phaseOrder) {
      const phaseData = recipe.phases[phaseKey];
      if (!phaseData?.ingredients) continue;

      for (const ingName of phaseData.ingredients) {
        const entry = ingredientMapByName.get(ingName.trim()) ?? ingredientMapByName.get(ingName);
        if (!entry) {
          warnings.push(
            `Phase "${phaseKey}" references ingredient "${ingName}" which is not in the ingredients list.`,
          );
          continue;
        }
        if (assignedIngredientEntryIds.has(entry.id)) {
          warnings.push(
            `Ingredient "${ingName}" is assigned multiple times; keeping first assignment to satisfy DAG 1.0 ratio.`,
          );
          continue;
        }

        phaseIngredientInputs[phaseKey].push({
          type: "ingredient",
          ingredientEntryId: entry.id,
          amountRatio: 1,
          amountText: null,
        });
        assignedIngredientEntryIds.add(entry.id);
      }
    }
  }

  // Auto-assign any remaining ingredients to guarantee DAG completeness (all ingredients used with ratio 1.0)
  for (const entry of convertedIngredients) {
    if (assignedIngredientEntryIds.has(entry.id)) continue;

    let targetPhase: (typeof phaseOrder)[number];
    if (entry.role === "seasoning") {
      targetPhase = "cook";
    } else if (entry.role === "topping") {
      targetPhase = "finish";
    } else if (entry.role === "optional") {
      targetPhase = "assemble";
    } else if (entry.prepNote) {
      targetPhase = "prep";
    } else {
      targetPhase = "cook";
    }

    if (recipe.phases) {
      warnings.push(
        `Ingredient "${entry.name}" was not assigned to any phase; auto-assigned to "${targetPhase}".`,
      );
    }

    phaseIngredientInputs[targetPhase].push({
      type: "ingredient",
      ingredientEntryId: entry.id,
      amountRatio: 1,
      amountText: null,
    });
    assignedIngredientEntryIds.add(entry.id);
  }

  // 3. Build RecipeStep DAG objects
  const steps: RecipeStep[] = phaseOrder.map((phaseKey) => {
    const meta = phaseMeta[phaseKey];
    const phaseData = recipe.phases?.[phaseKey];

    const stepId = `step-${phaseKey}`;
    const instruction = phaseData?.instruction?.trim() || meta.defaultInstruction;
    const durationSec =
      typeof phaseData?.durationSec === "number" && phaseData.durationSec >= 0
        ? phaseData.durationSec
        : meta.defaultDuration;
    const heatLevel = normalizeHeatLevel(phaseData?.heatLevel, meta.defaultHeat);

    const stepInputs: RecipeStep["inputs"] = [...phaseIngredientInputs[phaseKey]];

    if (meta.intermediateFrom) {
      stepInputs.push({
        type: "intermediate",
        fromStepId: meta.intermediateFrom.fromStepId,
        outputId: meta.intermediateFrom.outputId,
      });
    }

    return {
      id: stepId,
      stepNumber: meta.stepNumber,
      phase: phaseKey,
      title: meta.title,
      instruction: instruction.slice(0, 2000),
      executionMode: "active",
      timing: {
        activeDurationSec: durationSec,
        passiveDurationSec: 0,
        minTotalDurationSec: null,
        maxTotalDurationSec: null,
        scalingMode: "fixed",
        timerLabel: meta.title,
      },
      dependsOnStepIds: meta.dependsOn,
      resourceTags: [
        phaseKey === "cook" ? "cooktop" : phaseKey === "finish" ? "oven" : "prep-station",
      ],
      heatLevel,
      targetTempCelsius: heatLevel === "high" ? 220 : null,
      inputs: stepInputs,
      outputs: [
        {
          id: meta.outputId,
          label: meta.outputLabel,
        },
      ],
      completionCue: `${meta.title}が完了した状態`,
      cautions: [],
    };
  });

  const choRecipe: RecipeJson = {
    schemaVersion: "1.0",
    servings,
    summary: recipe.summary?.trim() || null,
    equipment: recipe.equipment ?? [],
    ingredientGroups: [],
    ingredients: convertedIngredients,
    steps,
    globalCautions: [],
  };

  // 4. Pre-flight dry run DAG validation
  const dagValidation = validateRecipeDag(choRecipe);
  if (!dagValidation.success) {
    warnings.push(...dagValidation.errors);
  }

  const dishPayload: Omit<Dish, "id"> & { id?: string } = {
    name: recipe.name.trim(),
    category: recipe.category?.trim() || null,
    servings,
    recipe: choRecipe,
    totalNutrition: null,
    totalCostYen: null,
    coverImageId: null,
    notes: recipe.summary?.trim() || null,
  };

  return {
    dishPayload,
    warnings,
  };
}

/**
 * Splits a large or multi-ingredient recipe (>maxIngredientsPerDish) into modular
 * component sub-recipes (e.g., base/sauce, main, garnish/topping) to avoid D1 parameter
 * bloating and large payload rejection.
 */
export function splitLargeRecipe(
  recipe: SimplifiedRecipe,
  maxIngredientsPerDish = 12,
): SimplifiedRecipe[] {
  const limit = Math.max(1, maxIngredientsPerDish);
  if (recipe.ingredients.length <= limit) {
    return [{ ...recipe, ingredients: [...recipe.ingredients] }];
  }

  const chunks: SimplifiedIngredient[][] = [];
  for (let i = 0; i < recipe.ingredients.length; i += limit) {
    chunks.push(recipe.ingredients.slice(i, i + limit));
  }

  const totalParts = chunks.length;
  return chunks.map((chunk, index) => {
    const partNum = index + 1;
    const chunkIngredientNames = new Set(chunk.map((ing) => ing.name));

    // Filter phases for sub-recipe if original phases are defined
    let subPhases: SimplifiedRecipe["phases"] | undefined;
    if (recipe.phases) {
      subPhases = {};
      for (const [key, phase] of Object.entries(recipe.phases)) {
        if (!phase) continue;
        const matching = phase.ingredients.filter((name) => chunkIngredientNames.has(name));
        if (matching.length > 0) {
          subPhases[key as keyof typeof recipe.phases] = {
            ...phase,
            ingredients: matching,
          };
        }
      }
      if (Object.keys(subPhases).length === 0) {
        subPhases = undefined;
      }
    }

    return {
      name: `${recipe.name} (パート ${partNum}/${totalParts})`,
      category: recipe.category,
      servings: recipe.servings,
      summary: recipe.summary ? `${recipe.summary} (パート ${partNum}/${totalParts})` : undefined,
      equipment: recipe.equipment ? [...recipe.equipment] : undefined,
      ingredients: chunk,
      ...(subPhases ? { phases: subPhases } : {}),
    };
  });
}
