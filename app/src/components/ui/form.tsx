import { Box, chakra, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

import { fieldControl } from "../../../theme/recipes/field-control";
import { formField } from "../../../theme/slot-recipes/form-field";

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

/**
 * フォーム項目。ラベル・コントロール・補助テキストの間隔を共通化する。
 */
export function Field({ label, htmlFor, help, error, children }: FieldProps) {
  const recipe = useSlotRecipe({ recipe: formField });
  const styles = recipe();

  return (
    <Box as={htmlFor ? "div" : "label"} css={styles.root}>
      {htmlFor ? (
        <chakra.label htmlFor={htmlFor} css={styles.label}>
          {label}
        </chakra.label>
      ) : (
        <Box as="span" css={styles.label}>
          {label}
        </Box>
      )}
      <Box css={styles.control}>{children}</Box>
      {help ? <Box css={styles.help}>{help}</Box> : null}
      {error ? <Box css={styles.error}>{error}</Box> : null}
    </Box>
  );
}

export function NativeInput(props: ComponentProps<"input">) {
  const recipe = useRecipe({ recipe: fieldControl });

  return <chakra.input {...props} css={recipe({ variant: "input" })} />;
}

export function NativeSelect(props: ComponentProps<"select">) {
  const recipe = useRecipe({ recipe: fieldControl });

  return (
    <chakra.select
      {...props}
      css={recipe({ variant: props.multiple ? "multiselect" : "select" })}
    />
  );
}

export function NativeTextArea(props: ComponentProps<"textarea">) {
  const recipe = useRecipe({ recipe: fieldControl });

  return <chakra.textarea {...props} css={recipe({ variant: "textarea" })} />;
}
