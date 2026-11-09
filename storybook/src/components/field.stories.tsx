import { Checkbox, Grid, Input, Stack, Switch, Textarea } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { NumberField } from "@/components/ui/number-field";
import { SelectField } from "@/components/ui/select-field";

const meta = {
  title: "Components/Field",
  component: Field,
  args: { label: "料理名", children: null },
  render: (args) => (
    <Stack maxW="420px">
      <Field {...args}>
        <Input placeholder="ポークカレー" />
      </Field>
    </Stack>
  ),
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Required: Story = { args: { required: true } };

export const WithHelper: Story = { args: { label: "合計料金", helperText: "税込の円で入力" } };

export const Invalid: Story = { args: { required: true, errorText: "料理名を入力してください" } };

export const Disabled: Story = { args: { disabled: true } };

const categories = [
  { value: "main", label: "主菜" },
  { value: "side", label: "副菜" },
  { value: "soup", label: "汁物" },
  { value: "staple", label: "主食" },
];

function FormExample() {
  const [category, setCategory] = useState("main");
  const [mealType, setMealType] = useState("dinner");
  const [servings, setServings] = useState("4");
  const [grams, setGrams] = useState("120");
  const [date, setDate] = useState("2026-11-10");
  const [notify, setNotify] = useState(true);

  return (
    <Stack gap="5" maxW="720px">
      <Grid templateColumns={{ base: "1fr", md: "2fr 1fr 1fr" }} gap="4">
        <Field label="料理名" required>
          <Input defaultValue="ポークカレー" />
        </Field>
        <Field label="カテゴリ">
          <NativeSelect options={categories} value={category} onChange={setCategory} />
        </Field>
        <NumberField
          label="基準の人前"
          value={servings}
          onChange={setServings}
          min={1}
          max={20}
          unit="人前"
        />
      </Grid>
      <Field label="概要">
        <Textarea defaultValue="玉ねぎを飴色になるまで炒め、隠し味にりんごを加える。" />
      </Field>
      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4">
        <DateField label="日付" value={date} onChange={setDate} />
        <SelectField
          label="食事区分"
          value={mealType}
          onChange={setMealType}
          options={[
            { value: "breakfast", label: "朝食" },
            { value: "lunch", label: "昼食" },
            { value: "dinner", label: "夕食" },
            { value: "snack", label: "間食" },
          ]}
        />
        <NumberField label="1単位あたりのグラム数" value={grams} onChange={setGrams} unit="g" />
      </Grid>
      <Field label="読み取り専用" readOnly>
        <Input readOnly defaultValue="ing_01HZX3" />
      </Field>
      <Stack gap="3">
        <Checkbox.Root defaultChecked>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>list_ingredients</Checkbox.Label>
        </Checkbox.Root>
        <Checkbox.Root>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>create_recipe</Checkbox.Label>
        </Checkbox.Root>
        <Switch.Root checked={notify} onCheckedChange={(details) => setNotify(details.checked)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>栄養価</Switch.Label>
        </Switch.Root>
      </Stack>
    </Stack>
  );
}

export const Form: Story = { render: () => <FormExample /> };
