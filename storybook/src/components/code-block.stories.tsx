import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CodeBlock } from "@/components/ui/code-block";

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  args: {
    label: "Hermes の設定コマンド",
    code: 'hermes config set mcp.servers.cho.url "https://cho.example.com/api/mcp"\nhermes config set mcp.servers.cho.headers.Authorization "Bearer cho_mcp_••••"',
  },
  render: (args) => (
    <Stack maxW="720px">
      <CodeBlock {...args} />
    </Stack>
  ),
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Json: Story = {
  args: {
    label: "JSON 設定",
    language: "json",
    code: JSON.stringify(
      {
        mcpServers: {
          cho: { url: "https://cho.example.com/api/mcp", transport: "streamable-http" },
        },
      },
      null,
      2,
    ),
  },
};
