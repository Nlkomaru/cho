import { ChakraProvider, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "../../app/src/components/ui/card";
import { DataTable, DataTableCell, DataTableRow } from "../../app/src/components/ui/data-table";
import { Feedback } from "../../app/src/components/ui/feedback";
import { Field, NativeInput, NativeSelect } from "../../app/src/components/ui/form";
import { StatBar } from "../../app/src/components/ui/stat-bar";
import { system } from "../../app/theme";

const meta = {
  title: "Surfaces/Design System",
  decorators: [
    (Story) => (
      <ChakraProvider value={system}>
        <Story />
      </ChakraProvider>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardSurface: Story = {
  render: () => (
    <Card
      title="鶏むね肉の照り焼き"
      meta="2026/11/08 12:30　自炊"
      footer={<Button variant="outline">詳細</Button>}
    >
      <Text textStyle="numeric.sm">¥420　·　520 kcal · P 42g / F 18g / C 12g</Text>
    </Card>
  ),
};

export const StatSummary: Story = {
  render: () => (
    <StatBar
      label="期間の集計"
      items={[
        { label: "料金", value: "¥1,240" },
        { label: "エネルギー", value: "640 kcal" },
        { label: "PFC", value: "P 24g / F 18g / C 86g / 食塩 2g", note: "1人前 P 12g" },
      ]}
    />
  ),
};

export const TableSurface: Story = {
  render: () => (
    <DataTable label="品目の内訳" columns={["品目", "料金", "エネルギー"]}>
      <DataTableRow>
        <DataTableCell>鶏むね肉</DataTableCell>
        <DataTableCell numeric>¥320</DataTableCell>
        <DataTableCell numeric>320 kcal</DataTableCell>
      </DataTableRow>
      <DataTableRow>
        <DataTableCell>ごはん</DataTableCell>
        <DataTableCell numeric>¥100</DataTableCell>
        <DataTableCell numeric>200 kcal</DataTableCell>
      </DataTableRow>
    </DataTable>
  ),
};

export const FormFields: Story = {
  render: () => (
    <Stack gap="4" w="20rem">
      <Field label="料理名">
        <NativeInput defaultValue="鶏むね肉の照り焼き" />
      </Field>
      <Field label="区分">
        <NativeSelect defaultValue="self_cooked">
          <option value="self_cooked">自炊</option>
          <option value="other">その他</option>
        </NativeSelect>
      </Field>
      <Feedback tone="error" role="alert">
        保存に失敗しました。
      </Feedback>
    </Stack>
  ),
};
