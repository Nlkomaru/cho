import { Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Foundations/Shape",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const radii = [
  ["none", "0", "カード・表・セクション・ガント"],
  ["l1", "2px", "バー・小さなチップ"],
  ["l2", "4px", "入力・タグ・メニュー・コード"],
  ["l3", "6px", "ダイアログ・ポップオーバー"],
  ["full", "9999px", "ボタン・番号の円"],
] as const;

const spacing = [
  ["1.5", "ラベル → 入力"],
  ["2", "カードを縦に並べる間隔"],
  ["4", "カードのグリッド・フォームの横間隔"],
  ["5", "セクション見出し → 本文・カードの余白"],
  ["12", "セクション間 (md 以上)"],
] as const;

export const Radii: Story = {
  render: () => (
    <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(5, 1fr)" }} gap="6" maxW="1000px">
      {radii.map(([token, value, use]) => (
        <Stack key={token} gap="2">
          <Box
            h="20"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.emphasized"
            borderRadius={token}
          />
          <Text textStyle="label" color="fg.strong">
            {token} · {value}
          </Text>
          <Text textStyle="caption" color="fg.muted">
            {use}
          </Text>
        </Stack>
      ))}
    </Grid>
  ),
};

export const RulesAndShadows: Story = {
  render: () => (
    <Stack gap="12" maxW="900px">
      <Section title="セクションの罫" meta="2px · border.strong">
        <Text color="fg.muted">見出しの下に紺の 2px 罫を引き、本文との間を 20px 空ける。</Text>
      </Section>
      <Stack gap="3">
        <Text textStyle="label" color="fg.muted">
          細罫 · 1px · border
        </Text>
        <Box h="1px" bg="border" />
      </Stack>
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="8">
        <Stack gap="3">
          <Box h="24" bg="bg.panel" borderRadius="l2" boxShadow="overlay" />
          <Text textStyle="label" color="fg.strong">
            shadow.overlay
          </Text>
          <Text textStyle="caption" color="fg.muted">
            メニュー・ポップオーバー・セレクト
          </Text>
        </Stack>
        <Stack gap="3">
          <Box h="24" bg="bg.panel" borderRadius="l3" boxShadow="dialog" />
          <Text textStyle="label" color="fg.strong">
            shadow.dialog
          </Text>
          <Text textStyle="caption" color="fg.muted">
            ダイアログ・ドロワー
          </Text>
        </Stack>
      </Grid>
      <HStack gap="3">
        <Button variant="outline">影なしのボタン</Button>
        <Box px="5" py="3" borderWidth="1px" borderColor="border">
          <Text textStyle="body.sm">影なしのカード</Text>
        </Box>
      </HStack>
    </Stack>
  ),
};

export const Spacing: Story = {
  render: () => (
    <Stack gap="0" maxW="720px">
      {spacing.map(([token, use]) => (
        <HStack key={token} gap="6" py="3" borderBottomWidth="1px" borderColor="border">
          <Box w="16" textStyle="label" color="fg.strong" fontVariantNumeric="tabular-nums">
            {token}
          </Box>
          <Box h="3" w={token} bg="red.600" flexShrink={0} />
          <Text textStyle="body.sm" color="fg.muted">
            {use}
          </Text>
        </HStack>
      ))}
    </Stack>
  ),
};
