import { HStack, chakra } from "@chakra-ui/react";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";

import { IconButton } from "./button";

export interface ServingsStepperProps {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
}

/**
 * 人前数の増減。分量・栄養価の換算に使う。
 */
export function ServingsStepper({ value, onChange, min = 1, max = 100 }: ServingsStepperProps) {
  const labelId = useId();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  return (
    <HStack gap="1.5" role="group" aria-labelledby={labelId}>
      <chakra.span id={labelId} srOnly>
        人前数
      </chakra.span>
      <IconButton
        size="sm"
        variant="outline"
        aria-label="1人前減らす"
        disabled={value <= min}
        onClick={() => set(value - 1)}
      >
        <Minus strokeWidth={1.75} />
      </IconButton>
      <chakra.output
        aria-live="polite"
        minW="16"
        textAlign="center"
        fontWeight="500"
        fontSize="15px"
        color="fg.strong"
        fontVariantNumeric="tabular-nums"
        whiteSpace="nowrap"
      >
        {value}人前
      </chakra.output>
      <IconButton
        size="sm"
        variant="outline"
        aria-label="1人前増やす"
        disabled={value >= max}
        onClick={() => set(value + 1)}
      >
        <Plus strokeWidth={1.75} />
      </IconButton>
    </HStack>
  );
}
