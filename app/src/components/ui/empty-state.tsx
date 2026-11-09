import { EmptyState as ChakraEmptyState, VStack } from "@chakra-ui/react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** 20px の線画アイコン。既定は Inbox。 */
  icon?: ReactNode;
  title: string;
  /** 1 文まで。 */
  description?: string;
  action?: ReactNode;
  size?: "sm" | "md";
  /** 見出しレベルが前後と合う場合だけ h2/h3 にする。既定は段落。 */
  titleAs?: "h2" | "h3" | "p";
}

/**
 * 空状態。灰色の円に赤いアイコン、見出し、1 文の説明、操作。
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  titleAs = "p",
}: EmptyStateProps) {
  return (
    <ChakraEmptyState.Root size={size}>
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator>
          {icon ?? <Inbox strokeWidth={1.75} />}
        </ChakraEmptyState.Indicator>
        <VStack gap="1">
          <ChakraEmptyState.Title as={titleAs}>{title}</ChakraEmptyState.Title>
          {description ? (
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          ) : null}
        </VStack>
        {action ? <VStack mt="2">{action}</VStack> : null}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
}
