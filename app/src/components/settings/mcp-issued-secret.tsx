import { Stack, Text } from "@chakra-ui/react";

import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Feedback } from "@/components/ui/feedback";

import type { McpIssuedSecret as McpIssuedSecretValue } from "./mcp-model";

export interface McpIssuedSecretProps {
  issued: McpIssuedSecretValue;
  onDismiss(): void;
}

/**
 * 発行直後のキー。秘密値はこのときだけ表示できる。
 */
export function McpIssuedSecret({ issued, onDismiss }: McpIssuedSecretProps) {
  return (
    <Feedback
      tone="success"
      title={`「${issued.name}」を発行しました`}
      action={
        <Button size="xs" variant="ghost" onClick={onDismiss}>
          閉じる
        </Button>
      }
    >
      <Stack gap="3" mt="1">
        <Text>キーはこの画面でしか表示されません。閉じる前に控えてください。</Text>
        <CodeBlock code={issued.secret} label="発行したキー" />
      </Stack>
    </Feedback>
  );
}
