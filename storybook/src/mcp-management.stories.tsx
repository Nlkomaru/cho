import { ChakraProvider } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  McpManagement,
  type McpManagerData,
  type McpManagerView,
} from "../../app/src/components/mcp-management";
import { system } from "../../app/theme";

const now = Date.parse("2026-11-09T12:00:00.000Z");
const tokens: McpManagerData["tokens"] = [
  {
    id: "demo-active",
    name: "献立プランナー",
    prefix: "demo-prefix-a",
    allowedTools: ["list_ingredients", "list_recipes"],
    createdAt: "2026-11-01T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: "2026-11-08T12:00:00.000Z",
  },
  {
    id: "demo-expired",
    name: "旧端末",
    prefix: "demo-prefix-b",
    allowedTools: ["list_ingredients"],
    createdAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null,
  },
  {
    id: "demo-revoked",
    name: "検証用",
    prefix: "demo-prefix-c",
    allowedTools: ["record_meal"],
    createdAt: "2026-10-01T00:00:00.000Z",
    expiresAt: null,
    revokedAt: "2026-11-02T00:00:00.000Z",
    lastUsedAt: null,
  },
];
const usage: McpManagerData["usage"] = [
  {
    tokenId: "demo-active",
    tokenName: "献立プランナー",
    toolName: "list_ingredients",
    day: "2026-11-08",
    count: 14,
  },
  {
    tokenId: "demo-active",
    tokenName: "献立プランナー",
    toolName: "create_recipe",
    day: "2026-11-08",
    count: 6,
  },
];
const ready = (
  data: McpManagerData,
  extra: Partial<Extract<McpManagerView, { kind: "ready" }>> = {},
): McpManagerView => ({ kind: "ready", data, activity: "idle", ...extra });

const meta = {
  title: "Settings/MCP Management",
  parameters: { layout: "padded" },
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

export const CredentialEntry: Story = { render: () => <McpManagement now={now} /> };
export const Loading: Story = {
  render: () => <McpManagement now={now} initialView={{ kind: "loading" }} />,
};
export const AuthenticationFailure: Story = {
  render: () => (
    <McpManagement
      now={now}
      initialView={{ kind: "error", message: "管理キーを確認してください。" }}
    />
  ),
};
export const ServerFailure: Story = {
  render: () => (
    <McpManagement
      now={now}
      initialView={{ kind: "error", message: "管理 API を利用できません。" }}
    />
  ),
};
export const Empty: Story = {
  render: () => <McpManagement now={now} initialView={ready({ tokens: [], usage: [] })} />,
};
export const Issuing: Story = {
  render: () => (
    <McpManagement now={now} initialView={ready({ tokens, usage }, { activity: "issuing" })} />
  ),
};
export const OneTimeSecretReveal: Story = {
  render: () => (
    <McpManagement
      now={now}
      initialView={ready({ tokens, usage }, { revealedSecret: "DEMO-SECRET-VISIBLE-ONCE" })}
    />
  ),
};
export const ActiveExpiredAndRevokedKeys: Story = {
  render: () => <McpManagement now={now} initialView={ready({ tokens, usage: [] })} />,
};
export const Revoking: Story = {
  render: () => (
    <McpManagement
      now={now}
      initialView={ready({ tokens, usage }, { activity: { revoking: "demo-active" } })}
    />
  ),
};
export const PopulatedUsage: Story = {
  render: () => <McpManagement now={now} initialView={ready({ tokens: [tokens[0]], usage })} />,
};
export const UsageWithoutTokens: Story = {
  render: () => <McpManagement now={now} initialView={ready({ tokens: [], usage })} />,
};
