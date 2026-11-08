import { Field } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Chakra Field のラベル付きラッパー。スタイルはChakraの recipe に任せる。
 */
export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <Field.Root flex="1" minWidth="0">
      <Field.Label htmlFor={htmlFor}>{label}</Field.Label>
      {children}
    </Field.Root>
  );
}
