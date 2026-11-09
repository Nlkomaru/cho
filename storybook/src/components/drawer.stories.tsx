import { Grid, Input, Stack, Textarea } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormDrawer } from "@/components/ui/form-drawer";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";

function IngredientDrawer({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  const [open, setOpen] = useState(true);
  const [dimension, setDimension] = useState<"mass" | "volume" | "count">("mass");
  const [kcal, setKcal] = useState("33");
  const [protein, setProtein] = useState("1");
  const [fat, setFat] = useState("0.1");

  return (
    <>
      <Button variant="outline" m="6" onClick={() => setOpen(true)}>
        材料を編集
      </Button>
      <FormDrawer
        open={open}
        onOpenChange={setOpen}
        title="玉ねぎ"
        size={size}
        onSubmit={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="danger" me="auto">
              削除
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary">
              保存
            </Button>
          </>
        }
      >
        <Stack gap="5">
          <SubHeading>基本</SubHeading>
          <Field label="材料名" required>
            <Input defaultValue="玉ねぎ" />
          </Field>
          <Stack gap="1.5">
            <SegmentedControl
              label="次元"
              value={dimension}
              onChange={setDimension}
              items={[
                { value: "mass", label: "質量" },
                { value: "volume", label: "体積" },
                { value: "count", label: "個数" },
              ]}
            />
          </Stack>
        </Stack>
        <Stack gap="5">
          <SubHeading
            trailing={
              <Button type="button" variant="outline" size="xs">
                <Sparkles />
                AIで推定
              </Button>
            }
          >
            栄養価
          </SubHeading>
          <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }} gap="4">
            <NumberField label="エネルギー" value={kcal} onChange={setKcal} unit="kcal" />
            <NumberField label="たんぱく質" value={protein} onChange={setProtein} unit="g" />
            <NumberField label="脂質" value={fat} onChange={setFat} unit="g" />
          </Grid>
        </Stack>
        <Stack gap="5">
          <SubHeading>メモ</SubHeading>
          <Field label="メモ">
            <Textarea defaultValue="新玉ねぎの時期は水分が多い。" />
          </Field>
        </Stack>
      </FormDrawer>
    </>
  );
}

const meta = {
  title: "Components/Drawer",
  component: IngredientDrawer,
  parameters: { layout: "fullscreen" },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md", "lg"] } },
} satisfies Meta<typeof IngredientDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FormDrawer_: Story = { name: "FormDrawer" };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
