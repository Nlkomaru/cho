import { Stack, Textarea } from "@chakra-ui/react";
import { useState } from "react";

import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";

export interface AiStructureDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 料理名と材料が入っていないと AI に渡せない。足りないものを並べる。 */
  missing: readonly string[];
  /** 既存の手順を置き換えるときの確認に使う。 */
  stepCount: number;
  busy?: boolean;
  error?: string;
  onSubmit(text: string): void;
}

/**
 * 貼り付けたレシピ本文から、登録済みの材料を使って手順を組み立てる。
 */
export function AiStructureDialog({
  open,
  onOpenChange,
  missing,
  stepCount,
  busy,
  error,
  onSubmit,
}: AiStructureDialogProps) {
  const [text, setText] = useState("");
  const blocked = missing.length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="テキストから作成"
      submitLabel="手順を作成"
      busy={busy}
      submitDisabled={blocked || !text.trim()}
      size="lg"
      onSubmit={() => onSubmit(text.trim())}
    >
      <Stack gap="4">
        {blocked ? (
          <Feedback tone="warning" size="sm" role="status">
            先に{missing.join("と")}を入力してください
          </Feedback>
        ) : null}
        {stepCount > 0 && !blocked ? (
          <Feedback tone="info" size="sm">
            いまの{stepCount}件の手順は置き換わります
          </Feedback>
        ) : null}
        {error ? (
          <Feedback tone="error" size="sm">
            {error}
          </Feedback>
        ) : null}
        <Field label="レシピ本文" required>
          <Textarea
            rows={12}
            value={text}
            placeholder={"1. 玉ねぎを薄切りにする\n2. 鍋に油を熱し、玉ねぎを中火で10分炒める"}
            onChange={(event) => setText(event.currentTarget.value)}
          />
        </Field>
      </Stack>
    </FormDialog>
  );
}
