import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const styles = [
  ["display", "28/36 → 36/44 · 500", "ポークカレー Pork Curry 2026"],
  ["heading.page", "24/32 → 30/38 · 500", "食事記録 Meals 12件"],
  ["heading.section", "20/28 · 500", "工程 Steps 52:00"],
  ["heading.card", "16/24 · 600", "玉ねぎを炒める Step 3"],
  ["heading.group", "14/20 · 600", "★ 隠し味 Group A"],
  ["body.lg", "16/27 · 400", "鍋に油を熱し、玉ねぎを中火で 10 分ほど飴色になるまで炒める。"],
  ["body", "15/24 · 400", "材料と分量は人前数に合わせて自動で換算されます。Onest 0123456789"],
  ["body.sm", "14/22 · 400", "主菜 · 4人前 · 調理 52分 · ¥1,240"],
  ["label", "13/18 · 500", "エネルギー / 合計料金 / Protein"],
  ["caption", "12/16 · 400", "10:00 · 20:00 · 100g あたり"],
  ["stat", "24/30 → 28/34 · 500", "2,708 kcal ¥1,240"],
  ["stat.sm", "18/24 · 500", "52:00 88.8 g"],
  ["mono", "13/20 · 400", "https://cho.example/api/mcp"],
] as const;

export const Scale: Story = {
  render: () => (
    <Stack gap="0" maxW="1000px">
      {styles.map(([name, spec, sample]) => (
        <Grid
          key={name}
          templateColumns={{ base: "1fr", md: "200px 1fr" }}
          gap={{ base: "2", md: "8" }}
          py="5"
          borderTopWidth="1px"
          borderColor="border"
          alignItems="baseline"
        >
          <Box>
            <Text textStyle="label" color="fg.strong">
              {name}
            </Text>
            <Text textStyle="caption" color="fg.subtle" fontVariantNumeric="tabular-nums">
              {spec}
            </Text>
          </Box>
          <Text
            textStyle={name}
            color={
              name.startsWith("heading") || name === "display" || name.startsWith("stat")
                ? "fg.strong"
                : "fg"
            }
            fontVariantNumeric={name.startsWith("stat") ? "tabular-nums" : undefined}
          >
            {sample}
          </Text>
        </Grid>
      ))}
    </Stack>
  ),
};

export const Numbers: Story = {
  render: () => (
    <Stack gap="4" maxW="480px">
      <Text textStyle="label" color="fg.muted">
        tabular-nums で桁を揃える
      </Text>
      {["1,240", "98", "12,708", "3.1"].map((value) => (
        <Text
          key={value}
          textStyle="stat.sm"
          color="fg.strong"
          textAlign="end"
          fontVariantNumeric="tabular-nums"
        >
          {value}
        </Text>
      ))}
    </Stack>
  ),
};
