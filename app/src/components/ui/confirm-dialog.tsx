import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { type ReactNode, useRef } from "react";

import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger: 削除などの取り消せない操作。primary: 通常の確定。 */
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm(): void;
}

/**
 * 確認ダイアログ。window.confirm の代わりに使う。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  tone = "danger",
  busy,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      // 取り消せない操作では誤って確定しないようキャンセルに、通常は確定ボタンにフォーカスを置く
      initialFocusEl={() => (tone === "danger" ? cancelRef.current : confirmRef.current)}
      role="alertdialog"
      size="sm"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">
              {description ? <Dialog.Description>{description}</Dialog.Description> : null}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button ref={cancelRef} variant="ghost" disabled={busy}>
                  {cancelLabel}
                </Button>
              </Dialog.ActionTrigger>
              <Button
                ref={confirmRef}
                variant={tone === "danger" ? "danger" : "primary"}
                loading={busy}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" variant="ghost" aria-label="閉じる" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
