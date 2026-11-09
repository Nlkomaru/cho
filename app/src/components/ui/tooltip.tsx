import { Portal, Tooltip as ChakraTooltip } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  /** 開く/閉じるを制御したい場合 (Storybook など)。 */
  open?: boolean;
}

/**
 * 紺地のツールチップ。children はフォーカス可能な要素 1 つにする。
 */
export function Tooltip({ content, children, disabled, placement = "top", open }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <ChakraTooltip.Root openDelay={200} closeDelay={50} positioning={{ placement }} open={open}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content>{content}</ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
}
