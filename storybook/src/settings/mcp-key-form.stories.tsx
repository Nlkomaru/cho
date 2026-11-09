import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { McpKeyForm, type McpKeyFormValue } from "@/components/settings/mcp-key-form";
import { mcpToolNames } from "@/domain/mcp";

interface DemoProps {
  initialValue: McpKeyFormValue;
  busy?: boolean;
  error?: string | null;
}

function McpKeyFormDemo({ initialValue, busy, error }: DemoProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <McpKeyForm
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      busy={busy}
      error={error}
    />
  );
}

const meta = {
  title: "Settings/McpKeyForm",
  component: McpKeyFormDemo,
  args: { initialValue: { name: "", expiresAt: "", allowedTools: [...mcpToolNames] } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof McpKeyFormDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    initialValue: {
      name: "Claude Desktop",
      expiresAt: "2026-12-31T23:59",
      allowedTools: ["list_ingredients", "list_recipes", "record_meal"],
    },
  },
};

export const NoTools: Story = {
  args: { initialValue: { name: "Hermes", expiresAt: "", allowedTools: [] } },
};

export const Issuing: Story = {
  args: {
    initialValue: { name: "Hermes", expiresAt: "", allowedTools: [...mcpToolNames] },
    busy: true,
  },
};

export const IssueError: Story = {
  args: { error: "有効期限が正しくありません。" },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
