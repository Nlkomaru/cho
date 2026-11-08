import { Box, ChakraProvider, Field, Input, Table, VStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Card } from "../../app/src/components/ui/card";
import { DateField } from "../../app/src/components/ui/date-field";
import { Feedback } from "../../app/src/components/ui/feedback";
import { Numeric } from "../../app/src/components/ui/numeric";
import { SelectField } from "../../app/src/components/ui/select-field";
import { StatBar } from "../../app/src/components/ui/stat-bar";
import { system } from "../../app/theme";

const options = [
  { value: "self_cooked", label: "自炊" },
  { value: "restaurant", label: "外食" },
];

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
    <Card title="鶏むね肉の照り焼き" meta="2026/11/08 12:30 自炊">
      <Box>
        料金 <Numeric size="sm">¥420</Numeric> ・ エネルギー <Numeric size="sm">520.4</Numeric> kcal
      </Box>
    </Card>
  ),
};

export const StatSummary: Story = {
  render: () => (
    <StatBar
      label="期間の集計"
      items={[
        {
          label: "料金",
          value: (
            <Numeric size="lg" tone="strong">
              ¥1,400
            </Numeric>
          ),
        },
        {
          label: "エネルギー",
          value: (
            <>
              <Numeric size="lg" tone="strong">
                1,200
              </Numeric>
              <Box as="span">kcal</Box>
            </>
          ),
        },
        {
          label: "PFC",
          value: (
            <Box as="span">
              P{" "}
              <Numeric size="lg" tone="strong">
                74
              </Numeric>{" "}
              g
            </Box>
          ),
        },
        {
          label: "食物繊維・食塩",
          value: (
            <Box as="span">
              食塩{" "}
              <Numeric size="lg" tone="strong">
                4.9
              </Numeric>{" "}
              g
            </Box>
          ),
        },
      ]}
    />
  ),
};

export const TableSurface: Story = {
  render: () => (
    <Table.Root size="sm">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>料理名</Table.ColumnHeader>
          <Table.ColumnHeader>料金</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>鶏むね肉の照り焼き</Table.Cell>
          <Table.Cell>
            <Numeric size="sm">¥420</Numeric>
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  ),
};

function FormExample() {
  const [date, setDate] = useState("2026-11-08");
  const [source, setSource] = useState("self_cooked");

  return (
    <VStack align="stretch" gap="4" w="22rem">
      <Field.Root>
        <Field.Label>料理名</Field.Label>
        <Input defaultValue="鶏むね肉の照り焼き" />
      </Field.Root>
      <SelectField label="区分" value={source} onChange={setSource} options={options} />
      <DateField label="日付" value={date} onChange={setDate} />
      <Feedback tone="status">日付は YYYY-MM-DD のまま保持します。</Feedback>
    </VStack>
  );
}

export const FormFields: Story = {
  render: () => <FormExample />,
};
