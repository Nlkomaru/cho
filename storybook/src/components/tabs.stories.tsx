import { Tabs, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

function SettingsTabs() {
  return (
    <Tabs.Root defaultValue="integrations" variant="line" maxW="720px">
      <Tabs.List>
        <Tabs.Trigger value="integrations">連携</Tabs.Trigger>
        <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="integrations">
        <Text color="fg.muted">OpenRouter と Inventia の接続設定</Text>
      </Tabs.Content>
      <Tabs.Content value="mcp">
        <Text color="fg.muted">クライアントキーと利用状況</Text>
      </Tabs.Content>
    </Tabs.Root>
  );
}

const meta = {
  title: "Components/Tabs",
  component: SettingsTabs,
} satisfies Meta<typeof SettingsTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
