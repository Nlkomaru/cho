import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { McpConnection } from "@/components/settings/mcp-connection";

import { MCP_ENDPOINT, issuedSecret } from "./fixtures";

function McpConnectionDemo({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  return <McpConnection endpointUrl={MCP_ENDPOINT} token={token} onTokenChange={setToken} />;
}

const meta = {
  title: "Settings/McpConnection",
  component: McpConnectionDemo,
  args: { initialToken: "" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof McpConnectionDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const WithKey: Story = { args: { initialToken: issuedSecret.secret } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
