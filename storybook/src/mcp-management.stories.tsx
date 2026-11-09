import { ChakraProvider } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  McpManagement,
  type McpManagementState,
  type McpTokenSummary,
  type McpTokenUsage,
} from "../../app/src/components/mcp-management";
import { system } from "../../app/theme";

const fixedNow = () => new Date("2026-11-09T12:00:00.000Z");

const tokens: McpTokenSummary[] = [
  {
    id: "token-hermes",
    name: "Hermes Agent",
    prefix: "cho_mcp_a1b2c3d4",
    allowedTools: [
      "list_ingredients",
      "create_ingredient",
      "list_recipes",
      "create_recipe",
      "record_meal",
    ],
    createdAt: "2026-11-01T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: "2026-11-09T10:30:00.000Z",
  },
  {
    id: "token-curator",
    name: "レシピ同期バッチ",
    prefix: "cho_mcp_e5f6a7b8",
    allowedTools: ["list_recipes", "create_recipe"],
    createdAt: "2026-10-15T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: "2026-11-08T18:45:00.000Z",
  },
  {
    id: "token-expired-dev",
    name: "旧開発環境 (MacBook)",
    prefix: "cho_mcp_99887766",
    allowedTools: ["list_ingredients", "list_recipes"],
    createdAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-05T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: "2026-11-04T16:20:00.000Z",
  },
  {
    id: "token-revoked-ci",
    name: "CI検証用 (漏洩失効)",
    prefix: "cho_mcp_deadbeef",
    allowedTools: ["record_meal"],
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
    revokedAt: "2026-11-02T14:00:00.000Z",
    lastUsedAt: "2026-11-02T13:58:00.000Z",
  },
];

const usage: McpTokenUsage[] = [
  {
    tokenId: "token-hermes",
    tokenName: "Hermes Agent",
    totalCalls: 170,
    tools: [
      {
        toolName: "list_ingredients",
        totalCalls: 100,
        daily: [
          { toolName: "list_ingredients", utcDate: "2026-11-01", callCount: 12 },
          { toolName: "list_ingredients", utcDate: "2026-11-03", callCount: 8 },
          { toolName: "list_ingredients", utcDate: "2026-11-05", callCount: 15 },
          { toolName: "list_ingredients", utcDate: "2026-11-07", callCount: 22 },
          { toolName: "list_ingredients", utcDate: "2026-11-08", callCount: 18 },
          { toolName: "list_ingredients", utcDate: "2026-11-09", callCount: 25 },
        ],
      },
      {
        toolName: "list_recipes",
        totalCalls: 50,
        daily: [
          { toolName: "list_recipes", utcDate: "2026-11-02", callCount: 5 },
          { toolName: "list_recipes", utcDate: "2026-11-05", callCount: 10 },
          { toolName: "list_recipes", utcDate: "2026-11-08", callCount: 15 },
          { toolName: "list_recipes", utcDate: "2026-11-09", callCount: 20 },
        ],
      },
      {
        toolName: "record_meal",
        totalCalls: 20,
        daily: [
          { toolName: "record_meal", utcDate: "2026-11-03", callCount: 4 },
          { toolName: "record_meal", utcDate: "2026-11-06", callCount: 6 },
          { toolName: "record_meal", utcDate: "2026-11-09", callCount: 10 },
        ],
      },
    ],
  },
  {
    tokenId: "token-curator",
    tokenName: "レシピ同期バッチ",
    totalCalls: 60,
    tools: [
      {
        toolName: "list_recipes",
        totalCalls: 48,
        daily: [
          { toolName: "list_recipes", utcDate: "2026-11-04", callCount: 14 },
          { toolName: "list_recipes", utcDate: "2026-11-06", callCount: 16 },
          { toolName: "list_recipes", utcDate: "2026-11-08", callCount: 18 },
        ],
      },
      {
        toolName: "create_recipe",
        totalCalls: 12,
        daily: [
          { toolName: "create_recipe", utcDate: "2026-11-04", callCount: 2 },
          { toolName: "create_recipe", utcDate: "2026-11-06", callCount: 4 },
          { toolName: "create_recipe", utcDate: "2026-11-08", callCount: 6 },
        ],
      },
    ],
  },
  {
    tokenId: "token-expired-dev",
    tokenName: "旧開発環境 (MacBook)",
    totalCalls: 20,
    tools: [
      {
        toolName: "list_ingredients",
        totalCalls: 20,
        daily: [
          { toolName: "list_ingredients", utcDate: "2026-11-01", callCount: 7 },
          { toolName: "list_ingredients", utcDate: "2026-11-02", callCount: 5 },
          { toolName: "list_ingredients", utcDate: "2026-11-04", callCount: 8 },
        ],
      },
    ],
  },
  {
    tokenId: "token-revoked-ci",
    tokenName: "CI検証用 (漏洩失効)",
    totalCalls: 5,
    tools: [
      {
        toolName: "record_meal",
        totalCalls: 5,
        daily: [
          { toolName: "record_meal", utcDate: "2026-11-01", callCount: 3 },
          { toolName: "record_meal", utcDate: "2026-11-02", callCount: 2 },
        ],
      },
    ],
  },
];

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

export const ActiveTokens: Story = {
  render: () => (
    <McpManagement
      now={fixedNow}
      initialState={
        {
          status: "ready",
          tokens,
          usage,
          issuedSecret: null,
        } satisfies McpManagementState
      }
    />
  ),
};

export const RevealedSecret: Story = {
  render: () => (
    <McpManagement
      now={fixedNow}
      initialState={
        {
          status: "ready",
          tokens: [
            {
              id: "token-hermes-cli",
              name: "Hermes CLI",
              prefix: "cho_mcp_01234567",
              allowedTools: ["list_ingredients", "list_recipes", "record_meal"],
              createdAt: "2026-11-09T12:00:00.000Z",
              expiresAt: null,
              revokedAt: null,
              lastUsedAt: null,
            },
            ...tokens,
          ],
          usage,
          issuedSecret: {
            name: "Hermes CLI",
            prefix: "cho_mcp_01234567",
            secret: "cho_mcp_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          },
        } satisfies McpManagementState
      }
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <McpManagement
      now={fixedNow}
      initialState={
        {
          status: "ready",
          tokens: [],
          usage: [],
          issuedSecret: null,
        } satisfies McpManagementState
      }
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <McpManagement
      now={fixedNow}
      initialState={
        {
          status: "loading",
        } satisfies McpManagementState
      }
    />
  ),
};

export const ServerFailure: Story = {
  render: () => (
    <McpManagement
      now={fixedNow}
      initialState={
        {
          status: "error",
          message: "Preview 環境では MCP トークン管理は無効です。",
        } satisfies McpManagementState
      }
    />
  ),
};
