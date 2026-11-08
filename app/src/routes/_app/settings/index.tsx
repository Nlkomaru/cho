import { Box, Button, Stack } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Feedback } from "../../../components/ui/feedback";
import { Field, NativeInput } from "../../../components/ui/form";
import { Page, PageHeader } from "../../../components/ui/page";
import { Section } from "../../../components/ui/section";

export const Route = createFileRoute("/_app/settings/")({
  staticData: { breadcrumbs: [{ label: "設定" }] },
  component: SettingsPage,
});

type IntegrationSettings = {
  openrouter: { configured: boolean; model: string };
  inventia: { configured: boolean; providerId: string | null };
};

function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [model, setModel] = useState("");
  const [providerId, setProviderId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/settings/integrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("設定を読み込めませんでした。");
        return (await response.json()) as IntegrationSettings;
      })
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setModel(data.openrouter.model);
        setProviderId(data.inventia.providerId ?? "");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "設定を読み込めませんでした。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const openrouter: { model: string; apiKey?: string } = { model: model.trim() };
    const inventia: { providerId?: string; token?: string } = {};
    if (apiKey.trim()) openrouter.apiKey = apiKey.trim();
    if (providerId.trim()) inventia.providerId = providerId.trim();
    if (token.trim()) inventia.token = token.trim();
    try {
      const response = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouter, inventia }),
      });
      const body = (await response.json()) as IntegrationSettings | { error?: string };
      if (!response.ok)
        throw new Error(
          "error" in body
            ? (body.error ?? "設定を保存できませんでした。")
            : "設定を保存できませんでした。",
        );
      const updated = body as IntegrationSettings;
      setSettings(updated);
      setModel(updated.openrouter.model);
      setProviderId(updated.inventia.providerId ?? "");
      setApiKey("");
      setToken("");
      setSuccess("設定を保存しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page size="sm">
      <PageHeader title="設定" />
      {loading ? (
        <Feedback tone="status" role="status" ariaLive="polite">
          設定を読み込み中…
        </Feedback>
      ) : null}
      {error && !settings ? (
        <Feedback tone="error" role="alert">
          {error}
        </Feedback>
      ) : null}
      {settings ? (
        <Box as="form" onSubmit={save}>
          <Stack gap="8" align="stretch">
            <Section title="OpenRouter" label="OpenRouter 設定">
              <Feedback tone="status">
                API キー: {settings.openrouter.configured ? "設定済み" : "未設定"}
              </Feedback>
              <Field label="API キー" htmlFor="openrouter-key">
                <NativeInput
                  id="openrouter-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="新しい API キー"
                />
              </Field>
              <Field label="モデル" htmlFor="openrouter-model">
                <NativeInput
                  id="openrouter-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  required
                />
              </Field>
            </Section>
            <Section title="Inventia" label="Inventia 設定">
              <Feedback tone="status">
                トークン: {settings.inventia.configured ? "設定済み" : "未設定"}
              </Feedback>
              <Field label="トークン" htmlFor="inventia-token">
                <NativeInput
                  id="inventia-token"
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="新しいトークン"
                />
              </Field>
              <Field label="Provider ID" htmlFor="inventia-provider">
                <NativeInput
                  id="inventia-provider"
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                />
              </Field>
            </Section>
            <Stack
              direction={{ base: "column", sm: "row" }}
              align={{ base: "stretch", sm: "center" }}
              gap="3"
            >
              <Button type="submit" colorPalette="red" loading={saving} disabled={loading}>
                設定を保存
              </Button>
              <Feedback tone="status" role="status" ariaLive="polite">
                {saving ? "保存中…" : success}
              </Feedback>
              {error ? (
                <Feedback tone="error" role="alert">
                  {error}
                </Feedback>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      ) : null}
    </Page>
  );
}
