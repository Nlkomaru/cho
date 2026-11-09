import { Input, Stack, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";

export interface RecipeMetaValues {
  name: string;
  category: string | null;
  notes: string | null;
}

export interface RecipeMetaDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  initial: RecipeMetaValues;
  busy?: boolean;
  /** 保存に失敗したときのメッセージ。 */
  error?: string;
  onSubmit(values: RecipeMetaValues): void;
}

/**
 * 料理名・カテゴリ・メモだけを編集するダイアログ。材料や手順はレシピ編集画面で扱う。
 */
export function RecipeMetaDialog({
  open,
  onOpenChange,
  initial,
  busy,
  error,
  onSubmit,
}: RecipeMetaDialogProps) {
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  // 開くたびに現在の値から始める
  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setCategory(initial.category ?? "");
    setNotes(initial.notes ?? "");
  }, [open, initial.name, initial.category, initial.notes]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="レシピ情報を編集"
      submitLabel="保存"
      busy={busy}
      submitDisabled={!name.trim()}
      onSubmit={() =>
        onSubmit({
          name: name.trim(),
          category: category.trim() || null,
          notes: notes.trim() ? notes : null,
        })
      }
    >
      <Stack gap="5">
        {error ? <Feedback tone="error">{error}</Feedback> : null}
        <Field label="料理名" required>
          <Input
            value={name}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="カテゴリ">
          <Input
            value={category}
            maxLength={64}
            placeholder="主菜"
            autoComplete="off"
            onChange={(event) => setCategory(event.target.value)}
          />
        </Field>
        <Field label="メモ">
          <Textarea
            value={notes}
            maxLength={4000}
            rows={5}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      </Stack>
    </FormDialog>
  );
}
