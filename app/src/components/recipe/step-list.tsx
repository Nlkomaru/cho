import { chakra } from "@chakra-ui/react";
import { useMemo } from "react";

import type { RecipeJson } from "@/domain/recipe";
import type { RecipeGanttBar } from "@/domain/recipe-scheduler";

import { describeStepInputs } from "./build-ingredient-items";
import { StepItem } from "./step-item";

export interface StepListProps {
  /** 手順と、投入の表示に使う材料・グループ。 */
  recipe: Pick<RecipeJson, "steps" | "ingredients" | "ingredientGroups">;
  /** 予定時刻とクリティカルパスの表示に使う。 */
  bars: readonly RecipeGanttBar[];
  /** 人前の倍率。投入量の換算に使う。 */
  scale: number;
  completedStepIds: readonly string[];
  onToggleComplete(stepId: string): void;
  activeStepId?: string | null;
  /** 手順番号を押したとき (工程表の該当行を表示する)。 */
  onStepSelect?(stepId: string): void;
}

/**
 * 手順の一覧。番号順に並べ、各手順に予定時刻・作業時間・投入・完了の目安・注意を出す。
 */
export function StepList({
  recipe,
  bars,
  scale,
  completedStepIds,
  onToggleComplete,
  activeStepId,
  onStepSelect,
}: StepListProps) {
  const barById = useMemo(() => new Map(bars.map((bar) => [bar.stepId, bar])), [bars]);
  const steps = useMemo(
    () => [...recipe.steps].sort((a, b) => a.stepNumber - b.stepNumber),
    [recipe.steps],
  );
  const stepById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps]);
  const completed = new Set(completedStepIds);

  return (
    <chakra.ol listStyle="none" m="0" p="0" css={{ "& > li:first-of-type": { pt: "2" } }}>
      {steps.map((step) => (
        <StepItem
          key={step.id}
          step={step}
          bar={barById.get(step.id)}
          inputs={describeStepInputs(step, recipe, scale)}
          dependencies={step.dependsOnStepIds
            .map((id) => stepById.get(id))
            .filter((dependency) => dependency !== undefined)
            .map((dependency) => ({
              id: dependency.id,
              stepNumber: dependency.stepNumber,
              title: dependency.title,
            }))}
          completed={completed.has(step.id)}
          active={activeStepId === step.id}
          onToggleComplete={onToggleComplete}
          onStepSelect={onStepSelect}
        />
      ))}
    </chakra.ol>
  );
}
