import { CloseButton, Drawer, Portal, chakra } from "@chakra-ui/react";
import type { FormEvent, ReactNode } from "react";

export interface FormDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  /** sm 400px / md 480px / lg 640px。 */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  /** フッターのボタン群。送信ボタンは type="submit" にする。 */
  footer: ReactNode;
  /** 渡すと本文とフッターを form で包み、送信時に呼ぶ。 */
  onSubmit?(): void;
}

/**
 * 右から開く編集用ドロワー。フッターは下端に固定する。
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  size = "md",
  children,
  footer,
  onSubmit,
}: FormDrawerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  const content = (
    <>
      <Drawer.Body>{children}</Drawer.Body>
      <Drawer.Footer>{footer}</Drawer.Footer>
    </>
  );

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      placement="end"
      size={size}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>{title}</Drawer.Title>
            </Drawer.Header>
            {onSubmit ? (
              <chakra.form
                onSubmit={handleSubmit}
                display="flex"
                flexDirection="column"
                flex="1"
                minH="0"
                overflow="auto"
              >
                {content}
              </chakra.form>
            ) : (
              content
            )}
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" variant="ghost" aria-label="閉じる" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
