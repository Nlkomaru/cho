import type { Meta, StoryObj } from "@storybook/react-vite";

import { McpManagement } from "@/components/settings/mcp-management";

import { MCP_ENDPOINT, fixedNow, issuedSecret, tokens, usage } from "./fixtures";

const meta = {
  title: "Settings/McpManagement",
  component: McpManagement,
  args: {
    now: fixedNow,
    endpointUrl: MCP_ENDPOINT,
    initialState: { status: "ready", tokens, usage, issuedSecret: null },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof McpManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const JustIssued: Story = {
  args: {
    initialState: {
      status: "ready",
      tokens: [
        {
          id: "token-claude",
          name: issuedSecret.name,
          prefix: issuedSecret.prefix,
          allowedTools: ["list_ingredients", "list_recipes", "record_meal"],
          createdAt: "2026-11-09T12:00:00.000Z",
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
        },
        ...tokens,
      ],
      usage,
      issuedSecret,
    },
  },
};

export const Empty: Story = {
  args: { initialState: { status: "ready", tokens: [], usage: [], issuedSecret: null } },
};

export const Loading: Story = { args: { initialState: { status: "loading" } } };

export const Disabled: Story = {
  args: {
    initialState: { status: "error", message: "この環境では MCP の管理が無効になっています。" },
  },
};
