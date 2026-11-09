import { CloseButton, Dialog, Portal, chakra } from "@chakra-ui/react";
import { type FormEvent, type ReactNode, useRef } from "react";

import { Button } from "./button";

export interface FormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
  submitLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  /** 送信ボタンを押せない状態にする (入力不足など)。 */
  submitDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  onSubmit(): void;
}

/**
 * 短いフォームのダイアログ。Enter で送信できるよう本文とフッターを form で包む。
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  submitLabel,
  cancelLabel = "キャンセル",
  busy,
  submitDisabled,
  size = "md",
  onSubmit,
}: FormDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && !submitDisabled) onSubmit();
  };

  const bodyRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      // 閉じるボタンではなく最初の入力欄にフォーカスを置く
      initialFocusEl={() =>
        bodyRef.current?.querySelector<HTMLElement>(
          "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)",
        ) ?? cancelRef.current
      }
      size={size}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <chakra.form onSubmit={handleSubmit} display="contents">
              <Dialog.Header>
                <Dialog.Title>{title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body ref={bodyRef}>{children}</Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button ref={cancelRef} type="button" variant="ghost" disabled={busy}>
                    {cancelLabel}
                  </Button>
                </Dialog.ActionTrigger>
                <Button type="submit" variant="primary" loading={busy} disabled={submitDisabled}>
                  {submitLabel}
                </Button>
              </Dialog.Footer>
            </chakra.form>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" variant="ghost" aria-label="閉じる" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
