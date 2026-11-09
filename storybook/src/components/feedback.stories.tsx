import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Toaster, toaster } from "@/components/ui/toaster";

const meta = {
  title: "Components/Feedback",
  component: Feedback,
  args: { tone: "info", children: "Inventia のトークンが未設定です。" },
  argTypes: {
    tone: { control: "inline-radio", options: ["info", "success", "warning", "error"] },
  },
  render: (args) => (
    <Stack maxW="640px">
      <Feedback {...args} />
    </Stack>
  ),
} satisfies Meta<typeof Feedback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <Stack gap="3" maxW="640px">
      <Feedback tone="info">在庫の同期は 1 時間ごとに行われます。</Feedback>
      <Feedback tone="success" title="トークンを発行しました">
        この値は一度しか表示されません。
      </Feedback>
      <Feedback tone="warning" title="揚げ油の温度">
        180℃ を超えると発火の恐れがあります。
      </Feedback>
      <Feedback
        tone="error"
        title="読み込めませんでした"
        action={
          <Button size="xs" variant="outline">
            再読み込み
          </Button>
        }
      >
        通信に失敗しました (502)
      </Feedback>
    </Stack>
  ),
};

export const Compact: Story = {
  args: { tone: "warning", size: "sm", children: "鍋が熱いので取っ手に注意。" },
};

export const Toast: Story = {
  render: () => (
    <Stack direction="row" gap="3">
      <Button
        variant="outline"
        onClick={() => toaster.create({ type: "success", title: "保存しました" })}
      >
        成功
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toaster.create({
            type: "error",
            title: "削除できませんでした",
            description: "通信に失敗しました",
          })
        }
      >
        エラー
      </Button>
      <Button
        variant="outline"
        onClick={() => toaster.create({ type: "info", title: "コピーしました" })}
      >
        情報
      </Button>
      <Toaster />
    </Stack>
  ),
  play: async () => {
    toaster.create({ type: "success", title: "保存しました", duration: 60_000 });
    toaster.create({
      type: "error",
      title: "削除できませんでした",
      description: "通信に失敗しました",
      duration: 60_000,
    });
  },
};
