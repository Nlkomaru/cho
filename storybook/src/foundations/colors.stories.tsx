import { Box, Grid, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "@/components/layout/section";

import { system } from "../../../app/theme";
import { semanticColors } from "../../../app/theme/semantic-tokens/colors";

const meta = {
  title: "Foundations/Colors",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const steps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

type TokenNode = { value?: unknown; DEFAULT?: TokenNode; [key: string]: unknown };

/**
 * 色トークンを生の値 (#rrggbb) に解決する。セマンティックトークンは `system.token` だと
 * `var(--…)` を返すので、`{colors.navy.900}` の参照をたどってパレットの値まで下りる。
 */
const hexOf = (token: string): string => {
  let node: unknown = semanticColors;
  for (const key of token.split(".")) {
    node = node && typeof node === "object" ? (node as TokenNode)[key] : undefined;
  }
  if (node && typeof node === "object") {
    const entry = node as TokenNode;
    const value = (entry.value ?? entry.DEFAULT?.value) as string | undefined;
    if (typeof value === "string") {
      const ref = /^\{colors\.(.+)\}$/.exec(value);
      return ref ? hexOf(ref[1]) : value;
    }
  }
  return String(system.token(`colors.${token}`));
};

/** WCAG の相対輝度からコントラスト比を求める。 */
const contrast = (a: string, b: string) => {
  const lum = (hex: string) => {
    const n = hex.replace("#", "").slice(0, 6);
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = Number.parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function Ramp({ name }: { name: "navy" | "red" }) {
  return (
    <Grid templateColumns={{ base: "repeat(4, 1fr)", md: "repeat(11, 1fr)" }} gap="2">
      {steps.map((step) => {
        const hex = String(hexOf(`${name}.${step}`));
        return (
          <Stack key={step} gap="1.5">
            <Box h="14" bg={`${name}.${step}`} borderWidth="1px" borderColor="border" />
            <Text textStyle="label" color="fg.strong">
              {step}
            </Text>
            <Text textStyle="caption" color="fg.muted" fontVariantNumeric="tabular-nums">
              {hex}
            </Text>
          </Stack>
        );
      })}
    </Grid>
  );
}

const semantic = [
  ["fg.strong", "見出し・値・紺のボタン"],
  ["fg", "本文"],
  ["fg.muted", "ラベル・補足"],
  ["fg.subtle", "単位・目盛り・キャプション"],
  ["fg.error", "エラー文"],
  ["accent.fg", "赤のアクセント (ロゴ・現在地・主要ボタン)"],
] as const;

const surfaces = [
  ["bg.panel", "カード・ダイアログ"],
  ["bg.subtle", "表の見出し・コード・読み取り専用"],
  ["bg.muted", "ホバー・アイコンの円・切り替えのトラック"],
  ["bg.error", "エラーの地"],
  ["border", "細罫 (#8d919a40)"],
  ["border.emphasized", "入力欄の枠"],
  ["border.strong", "2px のセクション罫・フォーカス"],
] as const;

export const Palette: Story = {
  render: () => (
    <Stack gap="12" maxW="1100px">
      <Section title="Navy">
        <Ramp name="navy" />
      </Section>
      <Section title="Red">
        <Ramp name="red" />
      </Section>
      <Section title="文字色" meta="白地に対するコントラスト比">
        <Stack gap="0">
          {semantic.map(([token, use]) => {
            const hex = String(hexOf(token));
            return (
              <HStack
                key={token}
                justify="space-between"
                py="3"
                borderBottomWidth="1px"
                borderColor="border"
                gap="4"
              >
                <HStack gap="3" minW="0">
                  <Box boxSize="5" bg={token} flexShrink={0} />
                  <Stack gap="0" minW="0">
                    <Text color={token} fontWeight="500">
                      {token}
                    </Text>
                    <Text textStyle="caption" color="fg.subtle">
                      {use}
                    </Text>
                  </Stack>
                </HStack>
                <chakra.span
                  textStyle="body.sm"
                  color="fg.strong"
                  fontVariantNumeric="tabular-nums"
                >
                  {contrast(hex, "#ffffff").toFixed(1)} : 1
                </chakra.span>
              </HStack>
            );
          })}
        </Stack>
      </Section>
      <Section title="面と罫">
        <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }} gap="4">
          {surfaces.map(([token, use]) => (
            <Stack key={token} gap="2">
              <Box
                h="16"
                bg={token.startsWith("bg") ? token : "bg.panel"}
                borderWidth={
                  token.startsWith("border") ? (token === "border.strong" ? "2px" : "1px") : "1px"
                }
                borderColor={token.startsWith("border") ? token : "border"}
              />
              <Text textStyle="label" color="fg.strong">
                {token}
              </Text>
              <Text textStyle="caption" color="fg.muted">
                {use}
              </Text>
            </Stack>
          ))}
        </Grid>
      </Section>
    </Stack>
  ),
};
