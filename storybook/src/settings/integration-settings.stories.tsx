import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  type IntegrationFieldError,
  type IntegrationFormValue,
  type IntegrationSettings,
  IntegrationSettingsForm,
} from "@/components/settings/integration-settings";

import { buildIntegrationSettings } from "./fixtures";

interface DemoProps {
  settings: IntegrationSettings;
  error?: string | null;
  fieldError?: IntegrationFieldError | null;
  saving?: boolean;
}

function IntegrationSettingsDemo({ settings, error, fieldError, saving }: DemoProps) {
  const [value, setValue] = useState<IntegrationFormValue>({
    apiKey: "",
    model: settings.openrouter.model,
    token: "",
    providerId: settings.inventia.providerId ?? "",
  });
  return (
    <IntegrationSettingsForm
      settings={settings}
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      saving={saving}
      error={error}
      fieldError={fieldError}
    />
  );
}

const meta = {
  title: "Settings/IntegrationSettings",
  component: IntegrationSettingsDemo,
  args: { settings: buildIntegrationSettings() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IntegrationSettingsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const Unset: Story = {
  args: {
    settings: buildIntegrationSettings({
      openrouter: { configured: false, usable: false, issue: "missing_token" },
      inventia: {
        configured: false,
        providerId: null,
        usable: false,
        issue: "missing_token",
        capabilities: undefined,
      },
    }),
  },
};

export const WithIssues: Story = {
  args: {
    settings: buildIntegrationSettings({
      openrouter: { usable: false, issue: "invalid_credentials" },
      inventia: { configured: false, usable: false, issue: "missing_encryption_key" },
    }),
  },
};

export const FieldError: Story = {
  args: {
    fieldError: { field: "model", message: "モデル ID が見つかりません。" },
    error: null,
  },
};

export const SaveError: Story = {
  args: { error: "設定を保存できませんでした。" },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
