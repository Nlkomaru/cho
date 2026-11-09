import { Box, chakra, Flex, HStack, Text } from "@chakra-ui/react";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DraftIssue } from "./recipe-draft";

/** 目次 (200px) + 間隔 + フォーム (800px)。ヘッダーの操作と保存バーの右端をフォームにそろえる。 */
export const EDITOR_MAX_W = { lg: "calc(200px + {spacing.16} + 800px)" } as const;

export interface EditorActionBarProps {
  /** 保存を試みた後の検証結果。空なら何も出さない。 */
  issues: readonly DraftIssue[];
  /** 保存 API のエラー。 */
  error?: string;
  busy?: boolean;
  submitLabel: string;
  onCancel(): void;
  onIssueSelect(issue: DraftIssue): void;
  /** 画面下に固定する (Storybook では false)。 */
  fixed?: boolean;
}

/**
 * 画面下に固定する保存バー。左に入力エラーの件数と最初のエラーへのリンク、右にキャンセルと保存。
 * 送信は親の form の submit で行う。
 */
export function EditorActionBar({
  issues,
  error,
  busy,
  submitLabel,
  onCancel,
  onIssueSelect,
  fixed = true,
}: EditorActionBarProps) {
  const first = issues[0];
  return (
    <Box
      position={fixed ? "fixed" : "relative"}
      insetX="0"
      bottom="0"
      zIndex="10"
      bg="bg.panel"
      borderTopWidth="1px"
      borderColor="border"
    >
      <Box
        maxW="calc({sizes.page.lg} + 2 * {spacing.12})"
        mx="auto"
        px={{ base: "4", md: "8", xl: "12" }}
      >
        <Flex maxW={EDITOR_MAX_W} py="3" gap="4" align="center" justify="space-between">
          <Box role="status" aria-live="polite" minW="0" flex="1">
            {first ? (
              <HStack gap="2" color="fg.error" minW="0">
                <CircleAlert
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <Text textStyle="body.sm" fontWeight="500" whiteSpace="nowrap">
                  {issues.length}件の入力エラー
                </Text>
                <chakra.button
                  type="button"
                  onClick={() => onIssueSelect(first)}
                  textStyle="body.sm"
                  color="fg.error"
                  textDecoration="underline"
                  textUnderlineOffset="3px"
                  cursor="pointer"
                  truncate
                  minW="0"
                  display={{ base: "none", md: "block" }}
                  focusVisibleRing="outside"
                >
                  {first.message}
                </chakra.button>
                <chakra.button
                  type="button"
                  onClick={() => onIssueSelect(first)}
                  textStyle="body.sm"
                  color="fg.error"
                  textDecoration="underline"
                  textUnderlineOffset="3px"
                  cursor="pointer"
                  whiteSpace="nowrap"
                  display={{ base: "block", md: "none" }}
                  focusVisibleRing="outside"
                >
                  確認
                </chakra.button>
              </HStack>
            ) : error ? (
              <HStack gap="2" color="fg.error" minW="0">
                <CircleAlert
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                />
                <Text textStyle="body.sm" lineClamp={2}>
                  {error}
                </Text>
              </HStack>
            ) : null}
          </Box>
          <HStack gap="2" flexShrink={0}>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {submitLabel}
            </Button>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
