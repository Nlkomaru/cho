import { Box, Field, NumberInput, chakra } from "@chakra-ui/react";

export interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** 入力欄の右端に表示する単位 ("g"、"人前" など)。 */
  unit?: string;
  size?: "sm" | "md";
  /** ラベルを視覚的に隠す (表の中など)。 */
  hideLabel?: boolean;
  /** 空欄のときに薄く見せる値 (空欄で使われる既定値など)。 */
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * 数値入力。値は文字列で受け渡し、入力途中の "1." なども保持する。
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  size = "md",
  hideLabel,
  placeholder,
  helperText,
  errorText,
  required,
  disabled,
}: NumberFieldProps) {
  return (
    <Field.Root
      w="full"
      minW="0"
      invalid={Boolean(errorText)}
      required={required}
      disabled={disabled}
    >
      <Field.Label srOnly={hideLabel}>
        {label}
        <Field.RequiredIndicator />
      </Field.Label>
      <NumberInput.Root
        w="full"
        size={size}
        value={value}
        onValueChange={(details) => onChange(details.value)}
        min={min}
        max={max}
        step={step}
        formatOptions={{ useGrouping: false, maximumFractionDigits: 6 }}
      >
        <Box position="relative">
          <NumberInput.Input pe={unit ? "12" : "3"} textAlign="start" placeholder={placeholder} />
          {unit ? (
            <chakra.span
              position="absolute"
              insetEnd="3"
              top="50%"
              transform="translateY(-50%)"
              color="fg.subtle"
              fontSize="14px"
              pointerEvents="none"
            >
              {unit}
            </chakra.span>
          ) : null}
        </Box>
      </NumberInput.Root>
      {helperText && !errorText ? <Field.HelperText>{helperText}</Field.HelperText> : null}
      {errorText ? <Field.ErrorText>{errorText}</Field.ErrorText> : null}
    </Field.Root>
  );
}
