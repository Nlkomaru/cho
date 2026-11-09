import { Skeleton, Stack, Tabs } from "@chakra-ui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import {
  type IntegrationFieldError,
  type IntegrationFormValue,
  type IntegrationSettings,
  IntegrationSettingsForm,
} from "@/components/settings/integration-settings";
import { McpManagement } from "@/components/settings/mcp-management";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { toaster } from "@/components/ui/toaster";
import { errorMessageFrom } from "@/lib/api-error";

type SettingsTab = "integrations" | "mcp";

export const Route = createFileRoute("/_app/settings/")({
  staticData: { breadcrumbs: [{ label: "設定" }] },
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } =>
    search.tab === "mcp" ? { tab: "mcp" } : {},
  component: SettingsPage,
});

function SettingsPage() {
  const { tab = "integrations" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <Page size="md">
      <PageHeader title="設定" />
      <Tabs.Root
        value={tab}
        onValueChange={(details) =>
          void navigate({
            search: details.value === "mcp" ? { tab: "mcp" } : {},
            replace: true,
            resetScroll: false,
          })
        }
        variant="line"
        lazyMount
      >
        <Tabs.List mb={{ base: "8", md: "10" }}>
          <Tabs.Trigger value="integrations">連携</Tabs.Trigger>
          <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="integrations" p="0">
          <IntegrationsTab />
        </Tabs.Content>
        <Tabs.Content value="mcp" p="0">
          <McpManagement />
        </Tabs.Content>
      </Tabs.Root>
    </Page>
  );
}

const toFormValue = (settings: IntegrationSettings): IntegrationFormValue => ({
  apiKey: "",
  model: settings.openrouter.model,
  token: "",
  providerId: settings.inventia.providerId ?? "",
});

function IntegrationsTab() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [value, setValue] = useState<IntegrationFormValue>({
    apiKey: "",
    model: "",
    token: "",
    providerId: "",
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<IntegrationFieldError | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    fetch("/api/settings/integrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("設定を読み込めませんでした。");
        return (await response.json()) as IntegrationSettings;
      })
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setValue(toFormValue(data));
      })
      .catch((cause: unknown) => {
        if (active)
          setLoadError(cause instanceof Error ? cause.message : "設定を読み込めませんでした。");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function save() {
    setSaving(true);
    setError(null);
    setFieldError(null);
    const apiKey = value.apiKey.trim();
    const token = value.token.trim();
    const model = value.model.trim();
    const providerId = value.providerId.trim();
    const openrouter: { model: string; apiKey?: string } = { model };
    const inventia: { providerId?: string; token?: string } = {};
    if (apiKey) openrouter.apiKey = apiKey;
    if (providerId) inventia.providerId = providerId;
    if (token) inventia.token = token;
    try {
      const response = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouter, inventia }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = errorMessageFrom(body, "設定を保存できませんでした。");
        if (response.status === 400) {
          // 400 はどの項目の問題かを推定して、その項目の下に出す
          const noModelSecret = !apiKey && !settings?.openrouter.configured;
          const noProviderSecret = !token && !settings?.inventia.configured;
          const field: IntegrationFieldError["field"] | null = /provider|プロバイダ/i.test(message)
            ? "provider"
            : /モデル|model/i.test(message)
              ? "model"
              : noProviderSecret && providerId
                ? "provider"
                : noModelSecret && model
                  ? "model"
                  : null;
          if (field) {
            setFieldError({ field, message });
            return;
          }
        }
        throw new Error(message);
      }
      const updated = body as IntegrationSettings;
      setSettings(updated);
      setValue(toFormValue(updated));
      toaster.create({ type: "success", title: "設定を保存しました" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  if (loadError && !settings) {
    return (
      <Feedback
        tone="error"
        action={
          <Button size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            再読み込み
          </Button>
        }
      >
        {loadError}
      </Feedback>
    );
  }

  if (!settings) {
    return (
      <Stack gap="6" role="status" aria-busy="true" aria-label="設定を読み込み中">
        <Skeleton h="40" />
        <Skeleton h="40" />
      </Stack>
    );
  }

  return (
    <IntegrationSettingsForm
      settings={settings}
      value={value}
      onChange={setValue}
      onSubmit={() => void save()}
      saving={saving}
      error={error}
      fieldError={fieldError}
    />
  );
}
