import type { Meta, StoryObj } from "@storybook/react-vite";

import { McpActivityChart } from "@/components/settings/mcp-activity-chart";
import { computeDailyActivity } from "@/components/settings/mcp-model";
import { McpUsage } from "@/components/settings/mcp-usage";

import { fixedNow, tokens, usage } from "./fixtures";

const meta = {
  title: "Settings/McpUsage",
  component: McpUsage,
  args: { usage, tokens, now: fixedNow() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof McpUsage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoUsage: Story = { args: { usage: [], tokens: [] } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const ActivityChart: StoryObj<typeof McpActivityChart> = {
  render: () => <McpActivityChart days={computeDailyActivity(usage, fixedNow())} />,
};
