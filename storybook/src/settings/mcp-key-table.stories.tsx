import type { Meta, StoryObj } from "@storybook/react-vite";

import { McpIssuedSecret } from "@/components/settings/mcp-issued-secret";
import { McpKeyTable } from "@/components/settings/mcp-key-table";

import { fixedNow, issuedSecret, tokens } from "./fixtures";

const meta = {
  title: "Settings/McpKeyTable",
  component: McpKeyTable,
  args: { tokens, now: fixedNow(), onRevoke: () => undefined },
} satisfies Meta<typeof McpKeyTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Revoking: Story = { args: { revokingId: "token-hermes" } };

export const Empty: Story = { args: { tokens: [] } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const IssuedSecret: StoryObj<typeof McpIssuedSecret> = {
  render: () => <McpIssuedSecret issued={issuedSecret} onDismiss={() => undefined} />,
};
