import { Field as ChakraField } from "@chakra-ui/react";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export interface FieldProps {
  label: ReactNode;
  /** 入力の取り違えを防ぐ短い補足 (単位など) だけを書く。 */
  helperText?: ReactNode;
  errorText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** 入力要素の id。省略時は Chakra が採番してラベルと結び付ける。 */
  id?: string;
  children: ReactNode;
}

/**
 * ラベル付きのフォーム項目。中には Input / Textarea / NativeSelect などを 1 つ置く。
 */
export function Field({
  label,
  helperText,
  errorText,
  required,
  disabled,
  readOnly,
  id,
  children,
}: FieldProps) {
  return (
    <ChakraField.Root
      ids={id ? { control: id } : undefined}
      invalid={Boolean(errorText)}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      minW="0"
    >
      <ChakraField.Label>
        {label}
        <ChakraField.RequiredIndicator />
      </ChakraField.Label>
      {children}
      {helperText && !errorText ? (
        <ChakraField.HelperText>{helperText}</ChakraField.HelperText>
      ) : null}
      {errorText ? (
        <ChakraField.ErrorText>
          <CircleAlert strokeWidth={1.75} aria-hidden="true" />
          {errorText}
        </ChakraField.ErrorText>
      ) : null}
    </ChakraField.Root>
  );
}
