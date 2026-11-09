import { Input, Textarea } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";

const meta = {
  title: "Components/Dialog",
  component: ConfirmDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    title: "このレシピを削除しますか？",
    description: "「ポークカレー」と手順・材料の設定が削除されます。食事記録は残ります。",
    confirmLabel: "削除する",
    onConfirm: () => undefined,
  },
  argTypes: { tone: { control: "inline-radio", options: ["danger", "primary"] } },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirm: Story = {};

export const ConfirmBusy: Story = { args: { busy: true } };

function MetaDialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} m="6">
        名前・カテゴリ・メモを編集
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="レシピ情報を編集"
        submitLabel="保存"
        onSubmit={() => setOpen(false)}
      >
        <Field label="料理名" required>
          <Input defaultValue="ポークカレー" />
        </Field>
        <Field label="カテゴリ">
          <Input defaultValue="主菜" />
        </Field>
        <Field label="メモ">
          <Textarea defaultValue="りんごは皮ごとすりおろす。" />
        </Field>
      </FormDialog>
    </>
  );
}

export const Form: Story = { render: () => <MetaDialog /> };
