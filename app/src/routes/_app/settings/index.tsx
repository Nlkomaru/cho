import { Button, chakra, Input, Link, Stack } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Feedback } from "../../../components/ui/feedback";
import { FormField } from "../-components/form-field";
import { errorMessageFrom } from "../../../lib/api-error";
import { Page, PageHeader } from "../../../components/ui/page";
import { Section } from "../../../components/ui/section";

export const Route = createFileRoute("/_app/settings/")({
  staticData: { breadcrumbs: [{ label: "設定" }] },
  component: SettingsPage,
});

type IntegrationIssue =
  | "missing_token"
  | "missing_encryption_key"
  | "invalid_credentials"
  | "invalid_configuration"
  | "missing_base_url"
  | "invalid_base_url";

type IntegrationSettings = {
  openrouter: {
    configured: boolean;
    model: string;
    usable?: boolean;
    issue?: IntegrationIssue | null;
  };
  inventia: {
    configured: boolean;
    providerId: string | null;
    usable?: boolean;
    issue?: IntegrationIssue | null;
    tokenSettingsUrl?: string | null;
    capabilities?: { readItems: boolean; writeStock: boolean };
  };
};

const openrouterIssueMessages: Record<IntegrationIssue, string> = {
  missing_token: "OpenRouter の API キーが未設定です。",
  missing_encryption_key:
    "サーバーの暗号化キーが未設定です。運用担当が SETTINGS_ENCRYPTION_KEY を設定する必要があります。",
  invalid_credentials: "認証情報が無効です。再設定してください。",
  invalid_configuration: "設定値が不正です。",
  missing_base_url: "Inventia のベース URL が未設定です。",
  invalid_base_url: "Inventia のベース URL が不正です。",
};

const inventiaIssueMessages: Record<IntegrationIssue, string> = {
  missing_token: "Inventia の API トークンが未設定です。下のリンクから発行してください。",
  missing_encryption_key:
    "サーバーの暗号化キーが未設定です。運用担当が SETTINGS_ENCRYPTION_KEY を設定する必要があります。",
  invalid_credentials: "Inventia の認証情報が無効です。トークンを再設定してください。",
  invalid_configuration: "Inventia の設定値が不正です。",
  missing_base_url: "Inventia のベース URL が未設定です。",
  invalid_base_url: "Inventia のベース URL が不正です。",
};

function openrouterIssue(issue: IntegrationIssue | null | undefined) {
  return issue ? openrouterIssueMessages[issue] : null;
}

function inventiaIssue(issue: IntegrationIssue | null | undefined) {
  return issue ? inventiaIssueMessages[issue] : null;
}

function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [model, setModel] = useState("");
  const [providerId, setProviderId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{
    field: "model" | "provider";
    message: string;
  } | null>(null);
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
    setFieldError(null);
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
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = errorMessageFrom(body, "設定を保存できませんでした。");
        if (response.status === 400) {
          const noModelSecret = !apiKey.trim() && !settings?.openrouter.configured;
          const noProviderSecret = !token.trim() && !settings?.inventia.configured;
          if (/provider|プロバイダ/i.test(message)) {
            setFieldError({ field: "provider", message });
            return;
          }
          if (/モデル|model/i.test(message)) {
            setFieldError({ field: "model", message });
            return;
          }
          if (noProviderSecret && providerId.trim()) {
            setFieldError({ field: "provider", message });
            return;
          }
          if (noModelSecret && model.trim()) {
            setFieldError({ field: "model", message });
            return;
          }
        }
        throw new Error(message);
      }
      const updated = body as IntegrationSettings;
      setFieldError(null);
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
        <chakra.form onSubmit={save}>
          <Stack gap="8" align="stretch">
            <Section title="OpenRouter" label="OpenRouter 設定">
              <Feedback tone="status">
                API キー: {settings.openrouter.configured ? "設定済み" : "未設定"} ・ 利用状態:{" "}
                {(settings.openrouter.usable ?? settings.openrouter.configured)
                  ? "利用可能"
                  : "利用不可"}
              </Feedback>
              {openrouterIssue(settings.openrouter.issue) ? (
                <Feedback tone="error">{openrouterIssue(settings.openrouter.issue)}</Feedback>
              ) : null}
              <FormField label="API キー" htmlFor="openrouter-key">
                <Input
                  id="openrouter-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="新しい API キー"
                />
              </FormField>
              <FormField label="モデル" htmlFor="openrouter-model">
                <Input
                  id="openrouter-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  aria-invalid={fieldError?.field === "model"}
                  required
                />
              </FormField>
              {fieldError?.field === "model" ? (
                <Feedback tone="error" role="alert">
                  {fieldError.message}
                </Feedback>
              ) : null}
            </Section>
            <Section title="Inventia" label="Inventia 設定">
              <Feedback tone="status">
                トークン: {settings.inventia.configured ? "設定済み" : "未設定"} ・ 利用状態:{" "}
                {(settings.inventia.usable ?? settings.inventia.configured)
                  ? "利用可能"
                  : "利用不可"}
              </Feedback>
              {inventiaIssue(settings.inventia.issue) ? (
                <Feedback tone="error">{inventiaIssue(settings.inventia.issue)}</Feedback>
              ) : null}
              {settings.inventia.tokenSettingsUrl ? (
                <Link
                  href={settings.inventia.tokenSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  alignSelf="start"
                >
                  Inventia でトークンを発行
                  <ExternalLinkIcon aria-hidden="true" size={14} />
                </Link>
              ) : null}
              {settings.inventia.capabilities ? (
                <Feedback tone="status">
                  品目読み取り: {settings.inventia.capabilities.readItems ? "利用可" : "利用不可"}{" "}
                  ・ 在庫書き込み: {settings.inventia.capabilities.writeStock ? "有効" : "無効"}
                  {settings.inventia.capabilities.writeStock
                    ? ""
                    : "（この環境では在庫書き込みを停止しています）"}
                </Feedback>
              ) : null}
              <FormField label="トークン" htmlFor="inventia-token">
                <Input
                  id="inventia-token"
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="新しいトークン"
                />
              </FormField>
              <FormField label="Provider ID" htmlFor="inventia-provider">
                <Input
                  id="inventia-provider"
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                  aria-invalid={fieldError?.field === "provider"}
                />
              </FormField>
              {fieldError?.field === "provider" ? (
                <Feedback tone="error" role="alert">
                  {fieldError.message}
                </Feedback>
              ) : null}
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
        </chakra.form>
      ) : null}
    </Page>
  );
}
