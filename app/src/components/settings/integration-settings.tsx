import { Badge, Box, Flex, Grid, Input, Stack, Text, chakra } from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";

export type IntegrationIssue =
  | "missing_token"
  | "missing_encryption_key"
  | "invalid_credentials"
  | "invalid_configuration"
  | "missing_base_url"
  | "invalid_base_url";

export interface IntegrationSettings {
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
}

export interface IntegrationFormValue {
  apiKey: string;
  model: string;
  token: string;
  providerId: string;
}

export interface IntegrationFieldError {
  field: "model" | "provider";
  message: string;
}

export interface IntegrationSettingsFormProps {
  settings: IntegrationSettings;
  value: IntegrationFormValue;
  onChange(value: IntegrationFormValue): void;
  onSubmit(): void;
  saving?: boolean;
  /** 項目に結び付かない保存エラー。 */
  error?: string | null;
  fieldError?: IntegrationFieldError | null;
}

const encryptionKeyMessage =
  "サーバーの暗号化キー (SETTINGS_ENCRYPTION_KEY) が未設定のため保存できません。";

const openrouterIssueMessages: Record<IntegrationIssue, string> = {
  missing_token: "API キーが未設定です。",
  missing_encryption_key: encryptionKeyMessage,
  invalid_credentials: "API キーが無効です。設定し直してください。",
  invalid_configuration: "設定値が正しくありません。",
  missing_base_url: "Inventia のベース URL が未設定です。",
  invalid_base_url: "Inventia のベース URL が正しくありません。",
};

const inventiaIssueMessages: Record<IntegrationIssue, string> = {
  missing_token: "トークンが未設定です。",
  missing_encryption_key: encryptionKeyMessage,
  invalid_credentials: "トークンが無効です。設定し直してください。",
  invalid_configuration: "設定値が正しくありません。",
  missing_base_url: "Inventia のベース URL が未設定です。",
  invalid_base_url: "Inventia のベース URL が正しくありません。",
};

export type IntegrationStatus = "connected" | "unset" | "error";

/** 状態バッジの判定。未設定のトークン以外の問題はエラーとして扱う。 */
export function integrationStatus(entry: {
  configured: boolean;
  usable?: boolean;
  issue?: IntegrationIssue | null;
}): IntegrationStatus {
  if (entry.issue && entry.issue !== "missing_token") return "error";
  if (!entry.configured) return "unset";
  if (entry.usable === false) return "error";
  return "connected";
}

const statusBadge: Record<IntegrationStatus, { label: string; palette: "green" | "navy" | "red" }> =
  {
    connected: { label: "接続済み", palette: "green" },
    unset: { label: "未設定", palette: "navy" },
    error: { label: "エラー", palette: "red" },
  };

interface IntegrationRowProps {
  name: string;
  status: IntegrationStatus;
  facts?: ReactNode;
  children: ReactNode;
}

function IntegrationRow({ name, status, facts, children }: IntegrationRowProps) {
  const badge = statusBadge[status];
  return (
    <Grid
      as="section"
      aria-label={name}
      templateColumns={{ base: "1fr", md: "minmax(0, 1fr) minmax(0, 2fr)" }}
      gap={{ base: "4", md: "8" }}
      py={{ base: "6", md: "8" }}
      borderTopWidth="1px"
      borderColor="border"
      _first={{ borderTopWidth: "0", pt: "0" }}
    >
      <Stack gap="2" align="start">
        <Flex align="center" gap="3" wrap="wrap">
          <chakra.h2 textStyle="heading.card" color="fg.strong">
            {name}
          </chakra.h2>
          <Badge colorPalette={badge.palette}>{badge.label}</Badge>
        </Flex>
        {facts}
      </Stack>
      <Stack gap="5">{children}</Stack>
    </Grid>
  );
}

function Capability({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Flex
      as="li"
      justify="space-between"
      gap="4"
      py="1.5"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Text textStyle="body.sm" color="fg.muted">
        {label}
      </Text>
      <Text textStyle="body.sm" color={enabled ? "fg.strong" : "fg.subtle"} fontWeight="500">
        {enabled ? "有効" : "無効"}
      </Text>
    </Flex>
  );
}

/**
 * 外部サービス (OpenRouter / Inventia) の接続設定。保存ボタンは 1 つにまとめる。
 */
export function IntegrationSettingsForm({
  settings,
  value,
  onChange,
  onSubmit,
  saving,
  error,
  fieldError,
}: IntegrationSettingsFormProps) {
  const { openrouter, inventia } = settings;
  // 未設定はバッジで分かるので、それ以外の問題だけ文で示す
  const issueMessage = (
    issue: IntegrationIssue | null | undefined,
    messages: Record<IntegrationIssue, string>,
  ) => (issue && issue !== "missing_token" ? messages[issue] : null);
  const openrouterIssue = issueMessage(openrouter.issue, openrouterIssueMessages);
  const inventiaIssue = issueMessage(inventia.issue, inventiaIssueMessages);
  const set = (patch: Partial<IntegrationFormValue>) => onChange({ ...value, ...patch });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <chakra.form onSubmit={submit} noValidate>
      <IntegrationRow name="OpenRouter" status={integrationStatus(openrouter)}>
        {openrouterIssue ? (
          <Feedback tone="error" size="sm" role="status">
            {openrouterIssue}
          </Feedback>
        ) : null}
        <Field
          label="API キー"
          helperText={openrouter.configured ? "空欄なら現在のキーを使います" : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            placeholder={openrouter.configured ? "••••••••" : "sk-or-…"}
            value={value.apiKey}
            onChange={(event) => set({ apiKey: event.currentTarget.value })}
          />
        </Field>
        <Field
          label="モデル"
          required
          errorText={fieldError?.field === "model" ? fieldError.message : undefined}
        >
          <Input
            value={value.model}
            spellCheck={false}
            placeholder="google/gemini-2.5-flash"
            onChange={(event) => set({ model: event.currentTarget.value })}
          />
        </Field>
      </IntegrationRow>

      <IntegrationRow
        name="Inventia"
        status={integrationStatus(inventia)}
        facts={
          inventia.capabilities ? (
            <chakra.ul
              listStyle="none"
              w="full"
              maxW={{ md: "240px" }}
              mt="2"
              borderTopWidth="1px"
              borderColor="border"
            >
              <Capability label="品目の読み取り" enabled={inventia.capabilities.readItems} />
              <Capability label="在庫の書き込み" enabled={inventia.capabilities.writeStock} />
            </chakra.ul>
          ) : null
        }
      >
        {inventiaIssue ? (
          <Feedback tone="error" size="sm" role="status">
            {inventiaIssue}
          </Feedback>
        ) : null}
        <Box>
          <Field
            label="トークン"
            helperText={inventia.configured ? "空欄なら現在のトークンを使います" : undefined}
          >
            <Input
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              placeholder={inventia.configured ? "••••••••" : undefined}
              value={value.token}
              onChange={(event) => set({ token: event.currentTarget.value })}
            />
          </Field>
          {inventia.tokenSettingsUrl ? (
            <Button asChild variant="link" size="sm" mt="2">
              <a href={inventia.tokenSettingsUrl} target="_blank" rel="noreferrer">
                Inventia でトークンを発行
                <ExternalLink strokeWidth={1.75} aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </Box>
        <Field
          label="Provider ID"
          errorText={fieldError?.field === "provider" ? fieldError.message : undefined}
        >
          <Input
            value={value.providerId}
            spellCheck={false}
            onChange={(event) => set({ providerId: event.currentTarget.value })}
          />
        </Field>
      </IntegrationRow>

      <Flex
        direction={{ base: "column", sm: "row" }}
        align={{ base: "stretch", sm: "center" }}
        justify="flex-end"
        gap="4"
        pt="6"
        borderTopWidth="1px"
        borderColor="border"
      >
        {error ? (
          <Box flex="1">
            <Feedback tone="error" size="sm">
              {error}
            </Feedback>
          </Box>
        ) : null}
        <Button type="submit" variant="primary" loading={saving}>
          保存
        </Button>
      </Flex>
    </chakra.form>
  );
}
