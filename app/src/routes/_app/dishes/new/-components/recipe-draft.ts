import type { Ingredient } from "@/domain/ingredient";
import {
  recipeSchema,
  type RecipeIngredientEntry,
  type RecipeIngredientGroup,
  type RecipeJson,
  type RecipeStep,
} from "@/domain/recipe";
import {
  computeRecipeGanttSchedule,
  validateRecipeDag,
  type RecipeGanttSchedule,
} from "@/domain/recipe-scheduler";

/** エディターが材料マスタから使う項目。 */
export type IngredientOption = Pick<Ingredient, "id" | "name" | "baseUnit">;
export type RecipeCaution = RecipeStep["cautions"][number];
export type GroupSymbol = RecipeIngredientGroup["symbol"];

/** レシピ以外の料理情報。 */
export interface DishFields {
  name: string;
  category: string;
  servings: string;
}

export interface RecipeDraft extends DishFields {
  /** 表紙画像の ID。 */
  coverImageId: string | null;
  recipe: RecipeJson;
}

export const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export const blankRecipe = (): RecipeJson => ({
  schemaVersion: "1.0",
  servings: 2,
  summary: null,
  equipment: [],
  ingredientGroups: [],
  ingredients: [],
  steps: [],
  globalCautions: [],
});

export const blankDraft = (): RecipeDraft => ({
  name: "",
  category: "",
  servings: "2",
  coverImageId: null,
  recipe: blankRecipe(),
});

export const emptyStep = (number: number): RecipeStep => ({
  id: makeId("step"),
  stepNumber: number,
  phase: "prep",
  title: "",
  instruction: "",
  executionMode: "active",
  timing: {
    activeDurationSec: 60,
    passiveDurationSec: 0,
    minTotalDurationSec: null,
    maxTotalDurationSec: null,
    scalingMode: "fixed",
    timerLabel: null,
  },
  dependsOnStepIds: [],
  resourceTags: [],
  heatLevel: "none",
  targetTempCelsius: null,
  inputs: [],
  outputs: [],
  completionCue: null,
  cautions: [],
  imageIds: [],
});

export const emptyEntry = (): RecipeIngredientEntry => ({
  id: makeId("ing"),
  ingredientId: "",
  name: "",
  amount: 0,
  unit: "",
  displayAmount: "",
  role: "main",
  groupId: null,
  prepNote: null,
});

export const emptyCaution = (): RecipeCaution => ({
  id: makeId("caution"),
  category: "quality",
  severity: "warning",
  title: "",
  description: "",
  triggerCondition: null,
});

export const phaseOptions = [
  { value: "prep", label: "下ごしらえ" },
  { value: "cook", label: "加熱調理" },
  { value: "assemble", label: "組み立て" },
  { value: "finish", label: "仕上げ" },
  { value: "cleanup", label: "片付け" },
] as const satisfies readonly { value: RecipeStep["phase"]; label: string }[];

export const executionOptions = [
  { value: "active", label: "作業" },
  { value: "passive", label: "待機" },
  { value: "mixed", label: "作業＋待機" },
] as const satisfies readonly { value: RecipeStep["executionMode"]; label: string }[];

export const scalingOptions = [
  { value: "fixed", label: "固定" },
  { value: "linear", label: "比例" },
  { value: "sublinear", label: "逓減" },
] as const satisfies readonly { value: RecipeStep["timing"]["scalingMode"]; label: string }[];

export const heatOptions = [
  { value: "none", label: "なし" },
  { value: "low", label: "弱火" },
  { value: "medium_low", label: "弱めの中火" },
  { value: "medium", label: "中火" },
  { value: "medium_high", label: "強めの中火" },
  { value: "high", label: "強火" },
  { value: "boil", label: "沸騰" },
  { value: "simmer", label: "煮立てる" },
] as const satisfies readonly { value: RecipeStep["heatLevel"]; label: string }[];

export const roleOptions = [
  { value: "main", label: "主材料" },
  { value: "seasoning", label: "調味料" },
  { value: "topping", label: "トッピング" },
  { value: "optional", label: "任意" },
] as const satisfies readonly { value: RecipeIngredientEntry["role"]; label: string }[];

export const cautionCategoryOptions = [
  { value: "safety", label: "安全" },
  { value: "quality", label: "品質" },
  { value: "timing", label: "タイミング" },
  { value: "substitution", label: "代替" },
  { value: "storage", label: "保存" },
] as const satisfies readonly { value: RecipeCaution["category"]; label: string }[];

export const severityOptions = [
  { value: "info", label: "情報" },
  { value: "warning", label: "注意" },
  { value: "critical", label: "重要" },
] as const satisfies readonly { value: RecipeCaution["severity"]; label: string }[];

export const groupSymbols: readonly GroupSymbol[] = ["★", "☆", "◎", "●", "▲", "A", "B", "C"];

/** 秒 → 分の表示 (小数 2 桁まで)。 */
export const formatMinutesInput = (sec: number | null) =>
  sec === null ? "" : String(Math.round((sec / 60) * 100) / 100);

export const stepLabel = (step: Pick<RecipeStep, "stepNumber" | "title">) =>
  step.title.trim() ? `手順${step.stepNumber} ${step.title.trim()}` : `手順${step.stepNumber}`;

/** 材料の所属 (entry.groupId) からグループの ingredientEntryIds を作り直す。 */
export function syncGroups(recipe: RecipeJson): RecipeJson {
  return {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      ingredientEntryIds: recipe.ingredients
        .filter((entry) => entry.groupId === group.id)
        .map((entry) => entry.id),
    })),
  };
}

export function removeEntry(recipe: RecipeJson, entryId: string): RecipeJson {
  return syncGroups({
    ...recipe,
    ingredients: recipe.ingredients.filter((entry) => entry.id !== entryId),
    steps: recipe.steps.map((step) => ({
      ...step,
      inputs: step.inputs.filter(
        (input) => input.type !== "ingredient" || input.ingredientEntryId !== entryId,
      ),
    })),
  });
}

export function removeGroup(recipe: RecipeJson, groupId: string): RecipeJson {
  return syncGroups({
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.filter((group) => group.id !== groupId),
    ingredients: recipe.ingredients.map((entry) =>
      entry.groupId === groupId ? { ...entry, groupId: null } : entry,
    ),
    steps: recipe.steps.map((step) => ({
      ...step,
      inputs: step.inputs.filter((input) => input.type !== "group" || input.groupId !== groupId),
    })),
  });
}

export function removeStep(recipe: RecipeJson, stepId: string): RecipeJson {
  return {
    ...recipe,
    steps: recipe.steps
      .filter((step) => step.id !== stepId)
      .map((step, index) => ({
        ...step,
        stepNumber: index + 1,
        dependsOnStepIds: step.dependsOnStepIds.filter((id) => id !== stepId),
        inputs: step.inputs.filter(
          (input) => input.type !== "intermediate" || input.fromStepId !== stepId,
        ),
      })),
  };
}

/** 保存する形に整える。空のグループは送らず、それを参照する投入も外す。 */
export function toSubmitRecipe(draft: RecipeDraft): unknown {
  const recipe = syncGroups(draft.recipe);
  const groups = recipe.ingredientGroups.filter((group) => group.ingredientEntryIds.length > 0);
  const kept = new Set(groups.map((group) => group.id));
  // 名前の無い生成物は送らず、それを参照する投入も外す
  const outputs = new Set(
    recipe.steps.flatMap((step) =>
      step.outputs
        .filter((output) => output.label.trim())
        .map((output) => `${step.id}::${output.id}`),
    ),
  );
  return {
    ...recipe,
    servings: Number(draft.servings),
    ingredientGroups: groups,
    steps: recipe.steps.map((step) => ({
      ...step,
      outputs: step.outputs.filter((output) => output.label.trim()),
      inputs: step.inputs.filter((input) =>
        input.type === "group"
          ? kept.has(input.groupId)
          : input.type === "intermediate"
            ? outputs.has(`${input.fromStepId}::${input.outputId}`)
            : true,
      ),
    })),
  };
}

export interface DraftIssue {
  /** フォーカスする入力要素の id。 */
  fieldId: string;
  message: string;
  /** 手順の中の項目なら、その手順を開く。 */
  stepId?: string;
}

export const fieldIds = {
  name: "recipe-name",
  servings: "recipe-servings",
  ingredients: "recipe-ingredients-add",
  steps: "recipe-steps-add",
  entry: (id: string, field: "ingredient" | "amount" | "display") => `entry-${id}-${field}`,
  group: (id: string) => `group-${id}-label`,
  step: (id: string, field: string) => `step-${id}-${field}`,
  caution: (id: string, field: "title" | "description") => `caution-${id}-${field}`,
} as const;

const blank = (value: string | null | undefined) => !value || !value.trim();

function cautionIssues(cautions: readonly RecipeCaution[], stepId?: string): DraftIssue[] {
  return cautions.flatMap((caution) => [
    ...(blank(caution.title)
      ? [{ fieldId: fieldIds.caution(caution.id, "title"), message: "注意の見出しを入力", stepId }]
      : []),
    ...(blank(caution.description)
      ? [
          {
            fieldId: fieldIds.caution(caution.id, "description"),
            message: "注意の説明を入力",
            stepId,
          },
        ]
      : []),
  ]);
}

/**
 * 画面で直せる入力漏れを、項目ごとの日本語メッセージにする。
 * これが空になってから、スキーマと DAG の検証 (英語) を重ねる。
 */
export function validateDraft(draft: RecipeDraft): DraftIssue[] {
  const { recipe } = draft;
  const issues: DraftIssue[] = [];
  if (blank(draft.name)) issues.push({ fieldId: fieldIds.name, message: "料理名を入力" });
  const servings = Number(draft.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 100)
    issues.push({ fieldId: fieldIds.servings, message: "人前は 1〜100 の整数で入力" });
  if (!recipe.ingredients.length)
    issues.push({ fieldId: fieldIds.ingredients, message: "材料を 1 つ以上追加" });
  recipe.ingredients.forEach((entry, index) => {
    const label = entry.name || `材料${index + 1}`;
    if (!entry.ingredientId)
      issues.push({
        fieldId: fieldIds.entry(entry.id, "ingredient"),
        message: `材料${index + 1}: 材料を選択`,
      });
    if (!(entry.amount > 0))
      issues.push({
        fieldId: fieldIds.entry(entry.id, "amount"),
        message: `${label}: 基準量を入力`,
      });
    if (blank(entry.displayAmount))
      issues.push({
        fieldId: fieldIds.entry(entry.id, "display"),
        message: `${label}: 表示分量を入力`,
      });
  });
  for (const group of recipe.ingredientGroups)
    if (blank(group.label))
      issues.push({ fieldId: fieldIds.group(group.id), message: "グループ名を入力" });
  if (!recipe.steps.length)
    issues.push({ fieldId: fieldIds.steps, message: "手順を 1 つ以上追加" });
  for (const step of recipe.steps) {
    const at = (field: string, message: string) =>
      issues.push({
        fieldId: fieldIds.step(step.id, field),
        message: `手順${step.stepNumber}: ${message}`,
        stepId: step.id,
      });
    if (blank(step.title)) at("title", "タイトルを入力");
    if (blank(step.instruction)) at("instruction", "手順本文を入力");
    for (const input of step.inputs)
      if (input.type === "ingredient" && !(input.amountRatio >= 0.01 && input.amountRatio <= 1))
        at(`ratio-${input.ingredientEntryId}`, "使用割合は 1〜100%");
    issues.push(...cautionIssues(step.cautions, step.id));
  }
  issues.push(...cautionIssues(recipe.globalCautions));
  return issues;
}

/** DAG の英語エラーを、材料・手順の名前に置き換えて読めるようにする。 */
function describeDagError(message: string, recipe: RecipeJson): string {
  const entryName = (id: string) => recipe.ingredients.find((entry) => entry.id === id)?.name;
  const stepName = (id: string) => {
    const step = recipe.steps.find((item) => item.id === id);
    return step ? `手順${step.stepNumber}` : undefined;
  };
  const unused = /^Ingredient (\S+) is never used$/.exec(message);
  if (unused) return `${entryName(unused[1]) ?? unused[1]} がどの手順でも使われていません`;
  const ratio = /^Ingredient (\S+) usage ratios total ([\d.]+)/.exec(message);
  if (ratio)
    return `${entryName(ratio[1]) ?? ratio[1]} の使用割合の合計が ${Math.round(
      Number(ratio[2]) * 100,
    )}% です (100% にする)`;
  const intermediate = /^Step (\S+) must depend on intermediate source (\S+)$/.exec(message);
  if (intermediate)
    return `${stepName(intermediate[1]) ?? intermediate[1]} は ${
      stepName(intermediate[2]) ?? intermediate[2]
    } に依存させてください`;
  if (message.includes("cycle")) return "手順の依存関係が循環しています";
  return message;
}

export type SubmitCheck =
  | { success: true; recipe: RecipeJson }
  | { success: false; issues: DraftIssue[] };

/** 保存前の検証。入力漏れ → スキーマ → DAG の順に見る。 */
export function checkDraft(draft: RecipeDraft): SubmitCheck {
  const issues = validateDraft(draft);
  if (issues.length) return { success: false, issues };
  const parsed = recipeSchema.safeParse(toSubmitRecipe(draft));
  if (!parsed.success)
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        fieldId: fieldIds.steps,
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
    };
  const dag = validateRecipeDag(parsed.data);
  if (!dag.success)
    return {
      success: false,
      issues: dag.errors.map((message) => ({
        fieldId: fieldIds.steps,
        message: describeDagError(message, parsed.data),
      })),
    };
  return { success: true, recipe: parsed.data };
}

const PREVIEW_ENTRY = "preview-entry";
const PREVIEW_GROUP = "preview-group";

/**
 * 入力途中のレシピから工程表のプレビューを作る。
 * 材料の入力が終わっていなくても見られるよう、手順の並びと時間だけで組み立てる。
 * 依存が循環しているときは null。
 */
export function previewSchedule(recipe: RecipeJson): RecipeGanttSchedule | null {
  if (!recipe.steps.length) return null;
  const stepIds = new Set(recipe.steps.map((step) => step.id));
  const seconds = (value: number, max: number) =>
    Math.min(max, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  const steps: RecipeStep[] = recipe.steps.map((step, index) => ({
    ...step,
    title: step.title.trim() || `手順${step.stepNumber}`,
    instruction: "-",
    timing: {
      ...step.timing,
      activeDurationSec: seconds(step.timing.activeDurationSec, 86400),
      passiveDurationSec: seconds(step.timing.passiveDurationSec, 604800),
      minTotalDurationSec: null,
      maxTotalDurationSec: null,
      timerLabel: null,
    },
    dependsOnStepIds: step.dependsOnStepIds.filter((id) => stepIds.has(id) && id !== step.id),
    resourceTags: step.resourceTags.filter((tag) => tag.trim()),
    targetTempCelsius: null,
    completionCue: null,
    cautions: [],
    outputs: [],
    // スキーマを満たすための仮の材料を最初の手順にだけ投入する
    inputs: index === 0 ? [{ type: "group", groupId: PREVIEW_GROUP }] : [],
  }));
  const preview: RecipeJson = {
    ...blankRecipe(),
    ingredients: [
      {
        id: PREVIEW_ENTRY,
        ingredientId: PREVIEW_ENTRY,
        name: "-",
        amount: 1,
        unit: "g",
        displayAmount: "-",
        role: "main",
        groupId: PREVIEW_GROUP,
        prepNote: null,
      },
    ],
    ingredientGroups: [
      { id: PREVIEW_GROUP, symbol: "★", label: "-", ingredientEntryIds: [PREVIEW_ENTRY] },
    ],
    steps,
  };
  if (!validateRecipeDag(preview).success) return null;
  const schedule = computeRecipeGanttSchedule(preview);
  return {
    ...schedule,
    bars: schedule.bars.map((bar) => ({ ...bar, inputsSummary: inputNames(recipe, bar.stepId) })),
  };
}

function inputNames(recipe: RecipeJson, stepId: string): string[] {
  const step = recipe.steps.find((item) => item.id === stepId);
  if (!step) return [];
  return step.inputs.flatMap((input) => {
    if (input.type === "ingredient") {
      const name = recipe.ingredients.find((entry) => entry.id === input.ingredientEntryId)?.name;
      return name ? [name] : [];
    }
    if (input.type === "group") {
      const group = recipe.ingredientGroups.find((item) => item.id === input.groupId);
      return group ? [`${group.symbol} ${group.label}`] : [];
    }
    const label = recipe.steps
      .find((item) => item.id === input.fromStepId)
      ?.outputs.find((output) => output.id === input.outputId)?.label;
    return label ? [label] : [];
  });
}
