import { Box, Checkbox, Fieldset, Flex, Input, SimpleGrid, Stack, chakra } from "@chakra-ui/react";
import type { FormEvent } from "react";

import { mcpToolNames, type McpToolName } from "@/domain/mcp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Feedback } from "@/components/ui/feedback";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { TimeField } from "@/components/ui/time-field";

import { mcpToolLabels } from "./mcp-model";

export interface McpKeyFormValue {
  name: string;
  /** `YYYY-MM-DDTHH:mm` (ローカル時刻)。空なら無期限。 */
  expiresAt: string;
  allowedTools: McpToolName[];
}

/** 日付だけ選んだときはその日の終わりまで有効にする。 */
const DEFAULT_EXPIRY_TIME = "23:59";

export interface McpKeyFormProps {
  value: McpKeyFormValue;
  onChange(value: McpKeyFormValue): void;
  onSubmit(): void;
  busy?: boolean;
  error?: string | null;
}

/**
 * MCP クライアントキーの発行フォーム。
 */
export function McpKeyForm({ value, onChange, onSubmit, busy, error }: McpKeyFormProps) {
  const [expiryDate = "", expiryTime = DEFAULT_EXPIRY_TIME] = value.expiresAt
    ? value.expiresAt.split("T")
    : [];
  const allSelected = value.allowedTools.length === mcpToolNames.length;
  const canSubmit = value.name.trim().length > 0 && value.allowedTools.length > 0 && !busy;

  const toggleTool = (tool: McpToolName, checked: boolean) =>
    onChange({
      ...value,
      allowedTools: checked
        ? mcpToolNames.filter((name) => name === tool || value.allowedTools.includes(name))
        : value.allowedTools.filter((name) => name !== tool),
    });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <chakra.form onSubmit={submit} noValidate>
      <Card
        title="新しいキー"
        footer={
          <Flex justify="flex-end" w="full">
            <Button type="submit" variant="primary" loading={busy} disabled={!canSubmit}>
              キーを発行
            </Button>
          </Flex>
        }
      >
        <Stack gap="5">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            <Field label="名前" required>
              <Input
                value={value.name}
                maxLength={100}
                autoComplete="off"
                placeholder="Hermes"
                onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
              />
            </Field>
            <SimpleGrid templateColumns="minmax(0, 1fr) 7rem" gap="3" alignItems="start">
              <Stack gap="1.5" minW="0">
                <DateField
                  label="有効期限"
                  value={expiryDate}
                  onChange={(date) =>
                    onChange({ ...value, expiresAt: date ? `${date}T${expiryTime}` : "" })
                  }
                />
                <chakra.p textStyle="caption" color="fg.subtle">
                  空欄なら無期限
                </chakra.p>
              </Stack>
              <TimeField
                label="時刻"
                value={expiryDate ? expiryTime : ""}
                disabled={!expiryDate}
                placeholder={DEFAULT_EXPIRY_TIME}
                onChange={(time) =>
                  onChange({ ...value, expiresAt: `${expiryDate}T${time || DEFAULT_EXPIRY_TIME}` })
                }
              />
            </SimpleGrid>
          </SimpleGrid>

          <Fieldset.Root>
            <Flex align="baseline" justify="space-between" gap="4" mb="2">
              <Fieldset.Legend textStyle="label" color="fg.muted">
                許可するツール
                <chakra.span
                  color="fg.subtle"
                  fontWeight="400"
                  ms="2"
                  fontVariantNumeric="tabular-nums"
                >
                  {value.allowedTools.length} / {mcpToolNames.length}
                </chakra.span>
              </Fieldset.Legend>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() =>
                  onChange({ ...value, allowedTools: allSelected ? [] : [...mcpToolNames] })
                }
              >
                {allSelected ? "すべて外す" : "すべて選択"}
              </Button>
            </Flex>
            <SimpleGrid
              columns={{ base: 1, sm: 2 }}
              columnGap="6"
              borderTopWidth="1px"
              borderColor="border"
            >
              {mcpToolNames.map((tool) => (
                <Box key={tool} borderBottomWidth="1px" borderColor="border">
                  <Checkbox.Root
                    size="sm"
                    w="full"
                    py="2.5"
                    alignItems="center"
                    checked={value.allowedTools.includes(tool)}
                    onCheckedChange={(details) => toggleTool(tool, details.checked === true)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label flex="1" display="flex" gap="2" alignItems="baseline" minW="0">
                      <chakra.span textStyle="body.sm" color="fg.strong">
                        {mcpToolLabels[tool]}
                      </chakra.span>
                      <chakra.span fontFamily="mono" fontSize="12px" color="fg.subtle" truncate>
                        {tool}
                      </chakra.span>
                    </Checkbox.Label>
                  </Checkbox.Root>
                </Box>
              ))}
            </SimpleGrid>
            {value.allowedTools.length === 0 ? (
              <Fieldset.HelperText color="fg.error" textStyle="caption" mt="2">
                ツールを 1 つ以上選んでください
              </Fieldset.HelperText>
            ) : null}
          </Fieldset.Root>

          {error ? <Feedback tone="error">{error}</Feedback> : null}
        </Stack>
      </Card>
    </chakra.form>
  );
}
