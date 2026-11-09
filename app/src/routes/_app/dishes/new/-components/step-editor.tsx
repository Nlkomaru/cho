import { Badge, Box, chakra, Grid, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { ChevronDown, CircleAlert, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";

import { SubHeading } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import type { RecipeIngredientEntry, RecipeIngredientGroup, RecipeStep } from "@/domain/recipe";
import { formatMinutes } from "@/lib/format";

import { CautionList } from "./caution-editor";
import { DraftNumberInput } from "./draft-number-input";
import {
  executionOptions,
  fieldIds,
  formatMinutesInput,
  heatOptions,
  phaseOptions,
  scalingOptions,
  stepLabel,
} from "./recipe-draft";
import { StepIoEditor } from "./step-io-editor";
import { TagInput } from "./tag-input";
import { ToggleChips } from "./toggle-chips";

export interface StepEditorProps {
  step: RecipeStep;
  /** 依存先・中間生成物の候補に使う全手順。 */
  steps: readonly RecipeStep[];
  entries: readonly RecipeIngredientEntry[];
  groups: readonly RecipeIngredientGroup[];
  expanded: boolean;
  onExpandedChange(expanded: boolean): void;
  errors?: Readonly<Record<string, string>>;
  /** この手順の入力エラー件数 (閉じているときに見出しへ出す)。 */
  errorCount?: number;
  /** 手順の写真の入力 (ImageUpload)。 */
  photos?: ReactNode;
  onChange(patch: Partial<RecipeStep>): void;
  onRemove(): void;
}

const toSeconds = (minutes: number) => Math.round(minutes * 60);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="4">
      <SubHeading as="h4">{title}</SubHeading>
      {children}
    </Stack>
  );
}

/**
 * 手順 1 件の編集カード。閉じているときは番号・タイトル・時間・依存だけを 1 行で見せる。
 */
export function StepEditor({
  step,
  steps,
  entries,
  groups,
  expanded,
  onExpandedChange,
  errors = {},
  errorCount = 0,
  photos,
  onChange,
  onRemove,
}: StepEditorProps) {
  const bodyId = useId();
  const id = (field: string) => fieldIds.step(step.id, field);
  const setTiming = (patch: Partial<RecipeStep["timing"]>) =>
    onChange({ timing: { ...step.timing, ...patch } });
  const depNumbers = steps
    .filter((item) => step.dependsOnStepIds.includes(item.id))
    .map((item) => item.stepNumber)
    .sort((a, b) => a - b);
  const { activeDurationSec: active, passiveDurationSec: passive } = step.timing;

  const minutesField = (
    label: string,
    value: number | null,
    onValue: (sec: number | null) => void,
    fieldId?: string,
  ) => (
    <Field label={label} id={fieldId} errorText={fieldId ? errors[fieldId] : undefined}>
      <DraftNumberInput
        unit="分"
        value={value}
        format={formatMinutesInput}
        parse={toSeconds}
        onChange={onValue}
      />
    </Field>
  );

  return (
    <Box
      as="li"
      listStyleType="none"
      id={`step-editor-${step.id}`}
      bg="bg.panel"
      borderWidth="1px"
      borderColor={expanded ? "navy.300" : "border"}
      scrollMarginTop="24"
    >
      <chakra.h3 m="0">
        <chakra.button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => onExpandedChange(!expanded)}
          display="grid"
          gridTemplateColumns="auto minmax(0, 1fr) auto"
          alignItems="center"
          columnGap="3"
          w="full"
          minH="14"
          px={{ base: "4", md: "5" }}
          py="3"
          textAlign="start"
          cursor="pointer"
          _hover={{ bg: "navy.50" }}
          focusVisibleRing="inside"
        >
          <chakra.span
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            boxSize="7"
            borderRadius="full"
            bg="navy.900"
            color="white"
            fontSize="13px"
            fontWeight="600"
            fontVariantNumeric="tabular-nums"
          >
            {step.stepNumber}
          </chakra.span>
          <chakra.span display="flex" flexDirection="column" gap="1" minW="0">
            <chakra.span
              textStyle="heading.card"
              color={step.title.trim() ? "fg.strong" : "fg.subtle"}
              truncate
            >
              {step.title.trim() || "タイトル未入力"}
              <chakra.span srOnly>{` 手順${step.stepNumber}`}</chakra.span>
            </chakra.span>
            <chakra.span display="flex" flexWrap="wrap" alignItems="center" gap="1.5">
              {active > 0 ? <Badge variant="outline">作業 {formatMinutes(active)}</Badge> : null}
              {passive > 0 ? <Badge variant="outline">待機 {formatMinutes(passive)}</Badge> : null}
              {step.imageIds.length ? (
                <Badge variant="outline">写真 {step.imageIds.length}</Badge>
              ) : null}
              {depNumbers.length ? (
                <chakra.span textStyle="caption" color="fg.subtle">
                  手順{depNumbers.join("・")}の後
                </chakra.span>
              ) : null}
              {errorCount > 0 ? (
                <Badge colorPalette="red" gap="1">
                  <CircleAlert size={12} strokeWidth={2} aria-hidden="true" />
                  {errorCount}件の入力エラー
                </Badge>
              ) : null}
            </chakra.span>
          </chakra.span>
          <chakra.span
            color="fg.muted"
            display="inline-flex"
            transition="transform 150ms"
            transform={expanded ? "rotate(180deg)" : undefined}
            aria-hidden="true"
          >
            <ChevronDown size={20} strokeWidth={1.75} />
          </chakra.span>
        </chakra.button>
      </chakra.h3>

      {expanded ? (
        <Stack
          id={bodyId}
          gap="8"
          px={{ base: "4", md: "5" }}
          pt="5"
          pb={{ base: "4", md: "5" }}
          borderTopWidth="1px"
          borderColor="border"
        >
          <Group title="基本">
            <Grid templateColumns={{ base: "1fr", md: "minmax(0, 10rem) minmax(0, 1fr)" }} gap="4">
              <Field label="工程">
                <NativeSelect
                  options={phaseOptions}
                  value={step.phase}
                  onChange={(value) => onChange({ phase: value as RecipeStep["phase"] })}
                />
              </Field>
              <Field label="タイトル" required id={id("title")} errorText={errors[id("title")]}>
                <Input
                  maxLength={120}
                  placeholder="玉ねぎを炒める"
                  value={step.title}
                  onChange={(event) => onChange({ title: event.currentTarget.value })}
                />
              </Field>
            </Grid>
            <Field
              label="手順本文"
              required
              id={id("instruction")}
              errorText={errors[id("instruction")]}
            >
              <Textarea
                maxLength={2000}
                rows={4}
                value={step.instruction}
                onChange={(event) => onChange({ instruction: event.currentTarget.value })}
              />
            </Field>
            {photos ? (
              <Stack gap="1.5" role="group" aria-labelledby={`${bodyId}-photos`}>
                <Text id={`${bodyId}-photos`} textStyle="label" color="fg">
                  写真
                </Text>
                {photos}
              </Stack>
            ) : null}
          </Group>

          <Group title="時間">
            <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(3, minmax(0, 1fr))" }} gap="4">
              <Field label="実行">
                <NativeSelect
                  options={executionOptions}
                  value={step.executionMode}
                  onChange={(value) =>
                    onChange({ executionMode: value as RecipeStep["executionMode"] })
                  }
                />
              </Field>
              {minutesField("作業時間", active, (sec) =>
                setTiming({ activeDurationSec: sec ?? 0 }),
              )}
              {minutesField("待機時間", passive, (sec) =>
                setTiming({ passiveDurationSec: sec ?? 0 }),
              )}
              {minutesField("最短の合計", step.timing.minTotalDurationSec, (sec) =>
                setTiming({ minTotalDurationSec: sec }),
              )}
              {minutesField("最長の合計", step.timing.maxTotalDurationSec, (sec) =>
                setTiming({ maxTotalDurationSec: sec }),
              )}
              <Field label="人数での伸縮">
                <NativeSelect
                  options={scalingOptions}
                  value={step.timing.scalingMode}
                  onChange={(value) =>
                    setTiming({ scalingMode: value as RecipeStep["timing"]["scalingMode"] })
                  }
                />
              </Field>
              <Field label="タイマー名">
                <Input
                  maxLength={64}
                  placeholder="煮込み"
                  value={step.timing.timerLabel ?? ""}
                  onChange={(event) => setTiming({ timerLabel: event.currentTarget.value || null })}
                />
              </Field>
              <Field label="目標温度">
                <DraftNumberInput
                  unit="℃"
                  value={step.targetTempCelsius}
                  onChange={(value) => onChange({ targetTempCelsius: value })}
                />
              </Field>
            </Grid>
          </Group>

          <Group title="投入・生成">
            <StepIoEditor
              step={step}
              steps={steps}
              entries={entries}
              groups={groups}
              errors={errors}
              onChange={onChange}
            />
          </Group>

          <Group title="依存">
            <ToggleChips
              label={`手順${step.stepNumber} の前に終える手順`}
              options={steps
                .filter((item) => item.id !== step.id)
                .map((item) => ({ value: item.id, label: stepLabel(item) }))}
              value={step.dependsOnStepIds}
              onChange={(ids) => onChange({ dependsOnStepIds: ids })}
              emptyText="他の手順はありません"
            />
          </Group>

          <Group title="器具・火加減・完了の目安">
            <Field label="器具" helperText="先頭の器具が工程表の行になる">
              <TagInput
                value={step.resourceTags}
                onChange={(tags) => onChange({ resourceTags: tags })}
                placeholder="鍋、コンロ"
              />
            </Field>
            <Grid templateColumns={{ base: "1fr", md: "minmax(0, 12rem) minmax(0, 1fr)" }} gap="4">
              <Field label="火加減">
                <NativeSelect
                  options={heatOptions}
                  value={step.heatLevel}
                  onChange={(value) => onChange({ heatLevel: value as RecipeStep["heatLevel"] })}
                />
              </Field>
              <Field label="完了の目安">
                <Input
                  maxLength={300}
                  placeholder="玉ねぎが透き通るまで"
                  value={step.completionCue ?? ""}
                  onChange={(event) =>
                    onChange({ completionCue: event.currentTarget.value || null })
                  }
                />
              </Field>
            </Grid>
          </Group>

          <Group title="注意">
            <CautionList
              cautions={step.cautions}
              errors={errors}
              onChange={(cautions) => onChange({ cautions })}
            />
          </Group>

          <Box
            pt="4"
            borderTopWidth="1px"
            borderColor="border"
            display="flex"
            justifyContent="flex-end"
          >
            <Button variant="danger" size="sm" onClick={onRemove}>
              <Trash2 />
              手順を削除
            </Button>
          </Box>
        </Stack>
      ) : null}
    </Box>
  );
}
