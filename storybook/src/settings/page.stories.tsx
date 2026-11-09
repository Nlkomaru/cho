import { Tabs } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import {
  type IntegrationFormValue,
  IntegrationSettingsForm,
} from "@/components/settings/integration-settings";
import { McpManagement } from "@/components/settings/mcp-management";

import { MCP_ENDPOINT, buildIntegrationSettings, fixedNow, tokens, usage } from "./fixtures";

const settings = buildIntegrationSettings();

function SettingsPageView({ tab }: { tab: "integrations" | "mcp" }) {
  const [value, setValue] = useState<IntegrationFormValue>({
    apiKey: "",
    model: settings.openrouter.model,
    token: "",
    providerId: settings.inventia.providerId ?? "",
  });
  return (
    <Page size="md">
      <PageHeader title="設定" />
      <Tabs.Root defaultValue={tab} variant="line" lazyMount>
        <Tabs.List mb={{ base: "8", md: "10" }}>
          <Tabs.Trigger value="integrations">連携</Tabs.Trigger>
          <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="integrations" p="0">
          <IntegrationSettingsForm
            settings={settings}
            value={value}
            onChange={setValue}
            onSubmit={() => undefined}
          />
        </Tabs.Content>
        <Tabs.Content value="mcp" p="0">
          <McpManagement
            now={fixedNow}
            endpointUrl={MCP_ENDPOINT}
            initialState={{ status: "ready", tokens, usage, issuedSecret: null }}
          />
        </Tabs.Content>
      </Tabs.Root>
    </Page>
  );
}

const meta = {
  title: "Settings/Page",
  component: SettingsPageView,
  args: { tab: "integrations" },
  parameters: { layout: "fullscreen", router: { path: "/settings" } },
} satisfies Meta<typeof SettingsPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Integrations: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mcp: Story = {
  args: { tab: "mcp" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const IntegrationsMobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const McpMobile: Story = {
  args: { tab: "mcp" },
  globals: { viewport: { value: "mobile", isRotated: false } },
};
