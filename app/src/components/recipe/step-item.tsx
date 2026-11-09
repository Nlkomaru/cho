import { Badge, Box, Checkbox, Flex, Stack, chakra } from "@chakra-ui/react";
import { Check, CircleCheck } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";

import { Feedback } from "@/components/ui/feedback";
import type { RecipeStep } from "@/domain/recipe";
import type { RecipeGanttBar } from "@/domain/recipe-scheduler";
import { formatClock, formatMinutes } from "@/lib/format";

import type { StepInputLine } from "./build-ingredient-items";
import { StepImages } from "./recipe-image";
import { heatLevelLabel } from "./recipe-labels";

export interface StepItemProps {
  step: RecipeStep;
  bar?: RecipeGanttBar;
  inputs: readonly StepInputLine[];
  /** 前提となる手順 (番号とタイトル)。 */
  dependencies: readonly { id: string; stepNumber: number; title: string }[];
  completed: boolean;
  active: boolean;
  onToggleComplete(stepId: string): void;
  onStepSelect?(stepId: string): void;
}

const FLASH_MS = 1200;

/**
 * 手順 1 件。番号 / 本文 / 完了チェックの 3 列。
 * ガントチャートから選ばれた直後は淡い赤で光らせ、その後は左の赤い線だけ残す。
 */
export const StepItem = forwardRef<HTMLLIElement, StepItemProps>(function StepItem(
  { step, bar, inputs, dependencies, completed, active, onToggleComplete, onStepSelect },
  ref,
) {
  const [flash, setFlash] = useState(false);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      setFlash(true);
      const timer = window.setTimeout(() => setFlash(false), FLASH_MS);
      wasActive.current = active;
      return () => window.clearTimeout(timer);
    }
    wasActive.current = active;
    return undefined;
  }, [active]);

  const critical = bar?.isCriticalPath ?? false;
  const heat = heatLevelLabel(step.heatLevel);
  const { activeDurationSec, passiveDurationSec, timerLabel } = step.timing;
  const meta = [
    activeDurationSec > 0 ? `作業 ${formatMinutes(activeDurationSec)}` : null,
    passiveDurationSec > 0 ? `待機 ${formatMinutes(passiveDurationSec)}` : null,
    heat ? `火加減 ${heat}` : null,
    step.targetTempCelsius != null ? `目標 ${step.targetTempCelsius}℃` : null,
    timerLabel ? `タイマー ${timerLabel}` : null,
  ].filter((value): value is string => Boolean(value));
  const extras = [
    step.resourceTags.length ? `器具 ${step.resourceTags.join("・")}` : null,
    step.outputs.length ? `→ ${step.outputs.map((output) => output.label).join("・")}` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <chakra.li
      ref={ref}
      id={`step-${step.id}`}
      display="grid"
      gridTemplateColumns={{
        base: "40px minmax(0, 1fr) auto",
        md: "48px minmax(0, 1fr) auto",
      }}
      columnGap={{ base: "3", md: "4" }}
      py="6"
      ps={{ base: "3", md: "4" }}
      pe="2"
      borderBottomWidth="1px"
      borderColor="border"
      scrollMarginTop="88px"
      boxShadow={active ? "inset 2px 0 0 var(--chakra-colors-red-600)" : "inset 0 0 0 transparent"}
      bg={flash ? "red.50" : "transparent"}
      transition="background-color 600ms ease-out, box-shadow 160ms"
      data-active={active ? "" : undefined}
    >
      <Box pt="0.5">
        <chakra.button
          type="button"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          boxSize="8"
          borderRadius="full"
          bg={completed ? "white" : critical ? "red.600" : "navy.900"}
          color={completed ? (critical ? "red.600" : "navy.900") : "white"}
          borderWidth={completed ? "1.5px" : "0"}
          borderColor={critical ? "red.600" : "navy.900"}
          fontSize="14px"
          fontWeight="600"
          fontVariantNumeric="tabular-nums"
          cursor="pointer"
          aria-label={`手順${step.stepNumber}を工程表で表示`}
          onClick={() => onStepSelect?.(step.id)}
        >
          {completed ? <Check size={16} strokeWidth={2.25} /> : step.stepNumber}
        </chakra.button>
      </Box>

      <Stack gap="3" minW="0">
        <Flex columnGap="3" rowGap="1" wrap="wrap" align="baseline">
          <chakra.h3 textStyle="heading.card" color={completed ? "fg.muted" : "fg.strong"}>
            {step.title}
          </chakra.h3>
          {bar ? (
            <chakra.span textStyle="caption" color="fg.subtle" fontVariantNumeric="tabular-nums">
              {formatClock(bar.startSec)}–{formatClock(bar.endSec)}
            </chakra.span>
          ) : null}
        </Flex>

        {meta.length ? (
          <Flex gap="1.5" wrap="wrap">
            {meta.map((item) => (
              <Badge key={item} variant="outline" fontVariantNumeric="tabular-nums">
                {item}
              </Badge>
            ))}
          </Flex>
        ) : null}

        <chakra.p textStyle="body.lg" color={completed ? "fg.muted" : "fg"} maxW="68ch">
          {step.instruction}
        </chakra.p>

        {step.imageIds.length ? (
          <StepImages imageIds={step.imageIds} stepNumber={step.stepNumber} />
        ) : null}

        {inputs.length ? (
          <chakra.p textStyle="body.sm" color={completed ? "fg.muted" : "fg"}>
            <chakra.span textStyle="label" color="fg.muted" me="2">
              投入
            </chakra.span>
            {inputs.map((input, index) => (
              <chakra.span key={input.key}>
                {index > 0 ? "、" : ""}
                {input.name}
                {input.amount ? (
                  <chakra.span color="fg.muted" fontVariantNumeric="tabular-nums">
                    {input.amount.startsWith("（") ? "" : " "}
                    {input.amount}
                  </chakra.span>
                ) : null}
              </chakra.span>
            ))}
          </chakra.p>
        ) : null}

        {step.completionCue ? (
          <Flex gap="1.5" align="start" textStyle="body.sm" color="fg.muted">
            <Box as="span" pt="1" flexShrink={0} color="fg.subtle">
              <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
            </Box>
            <span>
              <chakra.span srOnly>完了の目安: </chakra.span>
              {step.completionCue}
            </span>
          </Flex>
        ) : null}

        {step.cautions.length ? (
          <Stack gap="2">
            {step.cautions.map((caution) => (
              <Feedback
                key={caution.id}
                size="sm"
                role="status"
                tone={
                  caution.severity === "critical"
                    ? "error"
                    : caution.severity === "warning"
                      ? "warning"
                      : "info"
                }
                title={caution.title}
              >
                {caution.description}
                {caution.triggerCondition ? `（${caution.triggerCondition}）` : ""}
              </Feedback>
            ))}
          </Stack>
        ) : null}

        {dependencies.length || extras.length ? (
          <Flex textStyle="caption" color="fg.subtle" columnGap="3" rowGap="1" wrap="wrap">
            {dependencies.length ? (
              <span>
                {dependencies.map((dependency, index) => (
                  <chakra.span key={dependency.id}>
                    {index > 0 ? "・" : ""}
                    <chakra.a
                      href={`#step-${dependency.id}`}
                      color="fg.muted"
                      textDecoration="underline"
                      textUnderlineOffset="2px"
                      textDecorationColor="border.emphasized"
                      _hover={{ color: "red.600" }}
                    >
                      手順{dependency.stepNumber}
                    </chakra.a>
                  </chakra.span>
                ))}
                の後
              </span>
            ) : null}
            {extras.map((extra) => (
              <span key={extra}>{extra}</span>
            ))}
          </Flex>
        ) : null}
      </Stack>

      <Box pt="1">
        <Checkbox.Root
          checked={completed}
          onCheckedChange={() => onToggleComplete(step.id)}
          size="md"
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label srOnly>手順{step.stepNumber}を完了</Checkbox.Label>
        </Checkbox.Root>
      </Box>
    </chakra.li>
  );
});
