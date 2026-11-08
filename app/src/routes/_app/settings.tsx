import { Box, Button, Heading, Input, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/settings")({
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
    <Stack as="main" w="full" maxW="4xl" gap="8" px={{ base: "4", md: "8" }} py="8">
      <Heading as="h1" color="fg.subtle" fontSize="2xl" fontWeight="600">
        設定
      </Heading>
      {loading ? (
        <Text role="status" aria-live="polite">
          設定を読み込み中…
        </Text>
      ) : null}
      {error && !settings ? (
        <Text role="alert" color="red.fg">
          {error}
        </Text>
      ) : null}
      {settings ? (
        <Box as="form" onSubmit={save}>
          <Stack gap="8" align="stretch">
            <Stack
              as="section"
              aria-labelledby="openrouter-heading"
              gap="4"
              borderTopWidth="1px"
              borderColor="border"
              pt="5"
            >
              <Heading
                id="openrouter-heading"
                as="h2"
                fontSize="lg"
                fontWeight="600"
                color="fg.subtle"
              >
                OpenRouter
              </Heading>
              <Text color="fg" fontSize="sm">
                API キー: {settings.openrouter.configured ? "設定済み" : "未設定"}
              </Text>
              <Stack gap="1">
                <Text as="label" htmlFor="openrouter-key" fontSize="sm" fontWeight="600">
                  API キー
                </Text>
                <Input
                  id="openrouter-key"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="新しい API キー"
                />
              </Stack>
              <Stack gap="1">
                <Text as="label" htmlFor="openrouter-model" fontSize="sm" fontWeight="600">
                  モデル
                </Text>
                <Input
                  id="openrouter-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  required
                />
              </Stack>
            </Stack>
            <Stack
              as="section"
              aria-labelledby="inventia-heading"
              gap="4"
              borderTopWidth="1px"
              borderColor="border"
              pt="5"
            >
              <Heading
                id="inventia-heading"
                as="h2"
                fontSize="lg"
                fontWeight="600"
                color="fg.subtle"
              >
                Inventia
              </Heading>
              <Text color="fg" fontSize="sm">
                トークン: {settings.inventia.configured ? "設定済み" : "未設定"}
              </Text>
              <Stack gap="1">
                <Text as="label" htmlFor="inventia-token" fontSize="sm" fontWeight="600">
                  トークン
                </Text>
                <Input
                  id="inventia-token"
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="新しいトークン"
                />
              </Stack>
              <Stack gap="1">
                <Text as="label" htmlFor="inventia-provider" fontSize="sm" fontWeight="600">
                  Provider ID
                </Text>
                <Input
                  id="inventia-provider"
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                />
              </Stack>
            </Stack>
            <Stack
              direction={{ base: "column", sm: "row" }}
              align={{ base: "stretch", sm: "center" }}
              gap="3"
            >
              <Button type="submit" colorPalette="red" loading={saving} disabled={loading}>
                設定を保存
              </Button>
              <Text role="status" aria-live="polite" color="fg">
                {saving ? "保存中…" : success}
              </Text>
              {error ? (
                <Text role="alert" color="red.fg">
                  {error}
                </Text>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
