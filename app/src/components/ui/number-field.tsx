import { Field, NumberInput } from "@chakra-ui/react";

export interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField({ label, value, onChange, min, max, step }: NumberFieldProps) {
  return (
    <Field.Root w="full">
      <Field.Label>{label}</Field.Label>
      <NumberInput.Root
        w="full"
        value={value}
        onValueChange={(details) => onChange(details.value)}
        min={min}
        max={max}
        step={step}
      >
        <NumberInput.Input aria-label={label} />
        <NumberInput.Control />
      </NumberInput.Root>
    </Field.Root>
  );
}
