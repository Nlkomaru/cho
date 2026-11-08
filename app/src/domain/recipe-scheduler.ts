import { recipeSchema, type RecipeJson, type RecipeStep } from "./recipe";

export interface RecipeGanttBar {
  stepId: string;
  stepNumber: number;
  title: string;
  laneId: string;
  laneLabel: string;
  startSec: number;
  activeEndSec: number;
  endSec: number;
  dependsOnStepIds: string[];
  inputsSummary: string[];
  outputLabel: string | null;
  isCriticalPath: boolean;
}
export interface RecipeGanttSchedule {
  totalDurationSec: number;
  serialDurationSec: number;
  savedDurationSec: number;
  lanes: { id: string; label: string }[];
  bars: RecipeGanttBar[];
}
export interface RecipeDagValidation {
  success: boolean;
  errors: string[];
  data?: RecipeJson;
}

export function validateRecipeDag(input: unknown): RecipeDagValidation {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  const recipe = parsed.data;
  const errors: string[] = [];
  const steps = new Map(recipe.steps.map((step) => [step.id, step]));
  const entries = new Map(recipe.ingredients.map((entry) => [entry.id, entry]));
  const groups = new Map(recipe.ingredientGroups.map((group) => [group.id, group]));
  const duplicate = (values: string[]) =>
    values.filter((value, index) => values.indexOf(value) !== index);
  for (const id of duplicate(recipe.steps.map((s) => s.id)))
    errors.push(`Duplicate step id: ${id}`);
  for (const id of duplicate(recipe.ingredients.map((i) => i.id)))
    errors.push(`Duplicate ingredient id: ${id}`);
  for (const id of duplicate(recipe.ingredientGroups.map((g) => g.id)))
    errors.push(`Duplicate group id: ${id}`);
  for (const [groupId, group] of groups) {
    for (const entryId of group.ingredientEntryIds) {
      if (!entries.has(entryId))
        errors.push(`Group ${groupId} references missing ingredient ${entryId}`);
      else if (entries.get(entryId)?.groupId !== groupId)
        errors.push(`Group membership mismatch for ingredient ${entryId}`);
    }
  }
  for (const entry of recipe.ingredients) {
    if (entry.groupId && !groups.has(entry.groupId))
      errors.push(`Ingredient ${entry.id} references missing group ${entry.groupId}`);
    if (entry.groupId && !groups.get(entry.groupId)?.ingredientEntryIds.includes(entry.id))
      errors.push(`Ingredient ${entry.id} is missing from group ${entry.groupId}`);
  }
  for (const step of recipe.steps) {
    for (const dep of step.dependsOnStepIds)
      if (!steps.has(dep)) errors.push(`Step ${step.id} depends on missing step ${dep}`);
    for (const input of step.inputs) {
      if (input.type === "group" && !groups.has(input.groupId))
        errors.push(`Step ${step.id} references missing group ${input.groupId}`);
      if (input.type === "ingredient" && !entries.has(input.ingredientEntryId))
        errors.push(`Step ${step.id} references missing ingredient ${input.ingredientEntryId}`);
      if (input.type === "intermediate") {
        const source = steps.get(input.fromStepId);
        if (!source)
          errors.push(`Step ${step.id} references missing source step ${input.fromStepId}`);
        else if (!source.outputs.some((output) => output.id === input.outputId))
          errors.push(
            `Step ${step.id} references missing output ${input.outputId} from ${input.fromStepId}`,
          );
      }
    }
  }
  const reachable = (from: string, target: string, seen = new Set<string>()): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (steps.get(from)?.dependsOnStepIds ?? []).some((dep) => reachable(dep, target, seen));
  };
  for (const step of recipe.steps) {
    for (const input of step.inputs)
      if (
        input.type === "intermediate" &&
        steps.has(input.fromStepId) &&
        !reachable(step.id, input.fromStepId)
      ) {
        errors.push(`Step ${step.id} must depend on intermediate source ${input.fromStepId}`);
      }
  }
  const ratios = new Map<string, number>();
  const used = new Set<string>();
  for (const step of recipe.steps)
    for (const input of step.inputs) {
      if (input.type === "ingredient" && entries.has(input.ingredientEntryId)) {
        used.add(input.ingredientEntryId);
        ratios.set(
          input.ingredientEntryId,
          (ratios.get(input.ingredientEntryId) ?? 0) + input.amountRatio,
        );
      } else if (input.type === "group") {
        const group = groups.get(input.groupId);
        for (const entryId of group?.ingredientEntryIds ?? []) {
          used.add(entryId);
          ratios.set(entryId, (ratios.get(entryId) ?? 0) + 1);
        }
      }
    }
  for (const entry of recipe.ingredients) {
    if (!used.has(entry.id)) errors.push(`Ingredient ${entry.id} is never used`);
    const ratio = ratios.get(entry.id) ?? 0;
    if (
      used.has(entry.id) &&
      Math.abs(ratio - 1) > 0.01 + Number.EPSILON * Math.max(1, Math.abs(ratio))
    )
      errors.push(`Ingredient ${entry.id} usage ratios total ${ratio}, expected 1.0 ± 0.01`);
  }
  const states = new Map<string, number>();
  const visit = (id: string): boolean => {
    const state = states.get(id) ?? 0;
    if (state === 1) return false;
    if (state === 2) return true;
    states.set(id, 1);
    for (const dep of steps.get(id)?.dependsOnStepIds ?? [])
      if (steps.has(dep) && !visit(dep)) return false;
    states.set(id, 2);
    return true;
  };
  for (const id of steps.keys())
    if (!visit(id)) {
      errors.push("Recipe dependency graph contains a cycle");
      break;
    }
  return errors.length ? { success: false, errors } : { success: true, errors, data: recipe };
}

const duration = (step: RecipeStep) =>
  step.timing.activeDurationSec + step.timing.passiveDurationSec;
function criticalLengths(steps: RecipeStep[]): Map<string, number> {
  const children = new Map(steps.map((s) => [s.id, [] as RecipeStep[]]));
  for (const step of steps) for (const dep of step.dependsOnStepIds) children.get(dep)?.push(step);
  const memo = new Map<string, number>();
  const length = (step: RecipeStep): number => {
    const cached = memo.get(step.id);
    if (cached !== undefined) return cached;
    const value = duration(step) + Math.max(0, ...(children.get(step.id) ?? []).map(length));
    memo.set(step.id, value);
    return value;
  };
  for (const step of steps) length(step);
  return memo;
}
function summarizeInputs(step: RecipeStep, recipe: RecipeJson): string[] {
  return step.inputs.map((input) =>
    input.type === "ingredient"
      ? (recipe.ingredients.find((entry) => entry.id === input.ingredientEntryId)?.name ??
        input.ingredientEntryId)
      : input.type === "group"
        ? (recipe.ingredientGroups.find((group) => group.id === input.groupId)?.label ??
          input.groupId)
        : (recipe.steps
            .find((source) => source.id === input.fromStepId)
            ?.outputs.find((output) => output.id === input.outputId)?.label ?? input.outputId),
  );
}
export function computeRecipeGanttSchedule(input: RecipeJson | unknown): RecipeGanttSchedule {
  const checked = validateRecipeDag(input);
  if (!checked.success || !checked.data)
    throw new Error(`Invalid recipe DAG: ${checked.errors.join("; ")}`);
  const recipe = checked.data;
  const steps = [...recipe.steps];
  const critical = criticalLengths(steps);
  const children = new Map(steps.map((step) => [step.id, [] as RecipeStep[]]));
  for (const step of steps)
    for (const dependency of step.dependsOnStepIds) children.get(dependency)?.push(step);
  const criticalStepIds = new Set<string>();
  const roots = steps.filter((step) => step.dependsOnStepIds.length === 0);
  const overallCriticalLength = Math.max(0, ...roots.map((step) => critical.get(step.id)!));
  const traceCriticalPath = (step: RecipeStep) => {
    criticalStepIds.add(step.id);
    for (const child of children.get(step.id)!)
      if (critical.get(step.id) === duration(step) + critical.get(child.id)!)
        traceCriticalPath(child);
  };
  for (const root of roots)
    if (critical.get(root.id) === overallCriticalLength) traceCriticalPath(root);
  const scheduled = new Map<string, { start: number; activeEnd: number; end: number }>();
  const activeSlots: { start: number; end: number }[] = [];
  const resourceSlots = new Map<string, { start: number; end: number }[]>();
  const pending = new Set(steps.map((step) => step.id));
  while (pending.size) {
    const ready = steps
      .filter((s) => pending.has(s.id) && s.dependsOnStepIds.every((id) => scheduled.has(id)))
      .sort(
        (a, b) =>
          critical.get(b.id)! - critical.get(a.id)! ||
          a.stepNumber - b.stepNumber ||
          a.id.localeCompare(b.id),
      );
    if (!ready.length)
      throw new Error("Invalid recipe DAG: dependency cycle or missing dependency");
    const step = ready[0];
    const earliest = Math.max(0, ...step.dependsOnStepIds.map((id) => scheduled.get(id)!.end));
    const activeDuration = step.timing.activeDurationSec;
    const total = duration(step);
    let start = earliest;
    for (;;) {
      const conflicts = [
        ...(activeDuration
          ? activeSlots.filter((slot) => start < slot.end && start + activeDuration > slot.start)
          : []),
        ...step.resourceTags.flatMap((tag) =>
          (resourceSlots.get(tag) ?? []).filter(
            (slot) => start < slot.end && start + total > slot.start,
          ),
        ),
      ];
      if (!conflicts.length) break;
      start = Math.min(...conflicts.map((slot) => slot.end));
    }
    const activeEnd = start + activeDuration,
      end = activeEnd + step.timing.passiveDurationSec;
    scheduled.set(step.id, { start, activeEnd, end });
    pending.delete(step.id);
    if (activeDuration) activeSlots.push({ start, end: activeEnd });
    for (const tag of step.resourceTags) {
      const slots = resourceSlots.get(tag) ?? [];
      slots.push({ start, end });
      resourceSlots.set(tag, slots);
    }
  }
  const laneLabels = new Map<string, string>([
    ["cook-hand", "手作業"],
    ["waiting", "待機・放置"],
  ]);
  for (const step of steps) for (const tag of step.resourceTags) laneLabels.set(tag, tag);
  const bars = steps
    .map((step): RecipeGanttBar => {
      const times = scheduled.get(step.id)!;
      const laneId =
        step.resourceTags[0] ??
        (step.timing.passiveDurationSec && !step.timing.activeDurationSec
          ? "waiting"
          : "cook-hand");
      return {
        stepId: step.id,
        stepNumber: step.stepNumber,
        title: step.title,
        laneId,
        laneLabel: laneLabels.get(laneId)!,
        startSec: times.start,
        activeEndSec: times.activeEnd,
        endSec: times.end,
        dependsOnStepIds: [...step.dependsOnStepIds],
        inputsSummary: summarizeInputs(step, recipe),
        outputLabel: step.outputs.at(-1)?.label ?? null,
        isCriticalPath: criticalStepIds.has(step.id),
      };
    })
    .sort(
      (a, b) =>
        a.startSec - b.startSec || a.stepNumber - b.stepNumber || a.stepId.localeCompare(b.stepId),
    );
  const totalDurationSec = Math.max(0, ...bars.map((bar) => bar.endSec));
  const serialDurationSec = steps.reduce((sum, step) => sum + duration(step), 0);
  return {
    totalDurationSec,
    serialDurationSec,
    savedDurationSec: Math.max(0, serialDurationSec - totalDurationSec),
    lanes: [...laneLabels].map(([id, label]) => ({ id, label })),
    bars,
  };
}
export const computeRecipeSchedule = computeRecipeGanttSchedule;
