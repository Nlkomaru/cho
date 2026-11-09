import { Box, Grid, Input, Stack, Tabs, chakra } from "@chakra-ui/react";

import { CodeBlock } from "@/components/ui/code-block";
import { Field } from "@/components/ui/field";

import {
  MCP_TOKEN_PLACEHOLDER,
  buildClientConfigJson,
  buildCurlCommand,
  buildHermesCommand,
} from "./mcp-model";

export interface McpConnectionProps {
  endpointUrl: string;
  /** 設定例に埋め込むキー。空なら差し替え用の目印を出す。 */
  token: string;
  onTokenChange(token: string): void;
}

function Term({ children }: { children: string }) {
  return (
    <chakra.dt textStyle="label" color="fg.muted" pt={{ md: "3" }}>
      {children}
    </chakra.dt>
  );
}

/**
 * MCP クライアントの接続先と、クライアント別の設定例。
 */
export function McpConnection({ endpointUrl, token, onTokenChange }: McpConnectionProps) {
  const effective = token.trim() || MCP_TOKEN_PLACEHOLDER;
  const examples = [
    {
      value: "hermes",
      label: "Hermes",
      language: "shell",
      code: buildHermesCommand(endpointUrl, effective),
    },
    {
      value: "json",
      label: "JSON",
      language: "json",
      code: buildClientConfigJson(endpointUrl, effective),
    },
    {
      value: "curl",
      label: "curl",
      language: "shell",
      code: buildCurlCommand(endpointUrl, effective),
    },
  ];

  return (
    <Stack gap="8">
      <Grid
        as="dl"
        templateColumns={{ base: "1fr", md: "160px minmax(0, 1fr)" }}
        columnGap="6"
        rowGap={{ base: "1.5", md: "3" }}
      >
        <Term>エンドポイント</Term>
        <chakra.dd mb={{ base: "3", md: "0" }}>
          <CodeBlock code={endpointUrl} label="エンドポイント" />
        </chakra.dd>
        <Term>通信方式</Term>
        <chakra.dd
          mb={{ base: "3", md: "0" }}
          pt={{ md: "3" }}
          textStyle="body.sm"
          color="fg.strong"
        >
          Streamable HTTP (POST)
        </chakra.dd>
        <Term>認証ヘッダー</Term>
        <chakra.dd>
          <CodeBlock code={`Authorization: Bearer ${effective}`} label="認証ヘッダー" />
        </chakra.dd>
      </Grid>

      <Box>
        <Box maxW={{ md: "sm" }}>
          <Field label="設定例に入れるキー" helperText="ブラウザ内でだけ使い、送信しません">
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="cho_mcp_…"
              value={token}
              onChange={(event) => onTokenChange(event.currentTarget.value)}
            />
          </Field>
        </Box>

        <Tabs.Root defaultValue="hermes" variant="line" size="sm" mt="6" lazyMount={false}>
          <Tabs.List>
            {examples.map((example) => (
              <Tabs.Trigger key={example.value} value={example.value}>
                {example.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {examples.map((example) => (
            <Tabs.Content key={example.value} value={example.value} pt="4">
              <CodeBlock
                code={example.code}
                label={`${example.label} の設定例`}
                language={example.language}
              />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </Box>
    </Stack>
  );
}
