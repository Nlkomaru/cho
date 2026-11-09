import { Box, Flex, HStack, Stack, chakra } from "@chakra-ui/react";
import { useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatGroup, StatPart } from "@/components/ui/stat-group";
import { type NutritionFacts, scaleNutritionFacts } from "@/domain/nutrition";
import { EMPTY_VALUE, formatFixed, formatNumber, formatYen } from "@/lib/format";

export interface NutritionSummaryProps {
  facts: NutritionFacts | null;
  costYen?: number | null;
  /** 渡すと 全量 / 1人前 の切り替えを出し、1人前では人数で割る。 */
  servings?: number;
  /** stack: 横の列に縦積み、row: 全幅の StatGroup。 */
  layout?: "stack" | "row";
  /** 見出し。通常は親の Section が持つので省略する。 */
  title?: string;
}

type Basis = "total" | "serving";

const PFC_COLORS = { p: "navy.900", f: "navy.500", c: "navy.300" } as const;

const energyRatio = (facts: NutritionFacts) => {
  const p = facts.proteinG * 4;
  const f = facts.fatG * 9;
  const c = facts.carbohydrateG * 4;
  const total = p + f + c;
  if (total <= 0) return null;
  return { p: (p / total) * 100, f: (f / total) * 100, c: (c / total) * 100 };
};

/**
 * 栄養価と原価のまとめ。エネルギーを大きく、PFC はエネルギー比のバーで示す。
 */
export function NutritionSummary({
  facts,
  costYen,
  servings,
  layout = "stack",
  title,
}: NutritionSummaryProps) {
  const [basis, setBasis] = useState<Basis>("total");
  const divisor = servings && servings > 0 && basis === "serving" ? servings : 1;
  const shown = facts ? (divisor === 1 ? facts : scaleNutritionFacts(facts, 1 / divisor)) : null;
  const shownCost = costYen === null || costYen === undefined ? costYen : costYen / divisor;

  const toggle = servings ? (
    <SegmentedControl<Basis>
      label="栄養価の基準"
      size="xs"
      value={basis}
      onChange={setBasis}
      items={[
        { value: "total", label: "全量" },
        { value: "serving", label: "1人前" },
      ]}
    />
  ) : null;

  if (layout === "row") {
    return (
      <Stack gap="4">
        {title || toggle ? (
          <Flex justify="space-between" align="center" gap="3" wrap="wrap">
            {title ? (
              <chakra.h3 textStyle="heading.card" color="fg.strong">
                {title}
              </chakra.h3>
            ) : (
              <span />
            )}
            {toggle}
          </Flex>
        ) : null}
        <StatGroup
          label={title ?? "栄養価と原価"}
          items={[
            ...(costYen !== undefined ? [{ label: "原価", value: formatYen(shownCost) }] : []),
            {
              label: "エネルギー",
              value: formatNumber(shown?.caloriesKcal, 0),
              unit: shown ? "kcal" : undefined,
            },
            {
              label: "PFC",
              value: shown ? (
                <>
                  <StatPart label="P" value={formatFixed(shown.proteinG)} unit="g" />
                  <StatPart label="F" value={formatFixed(shown.fatG)} unit="g" />
                  <StatPart label="C" value={formatFixed(shown.carbohydrateG)} unit="g" />
                </>
              ) : (
                EMPTY_VALUE
              ),
            },
            {
              label: "食物繊維・食塩",
              value: shown ? (
                <>
                  <StatPart label="繊維" value={formatFixed(shown.fiberG)} unit="g" />
                  <StatPart label="塩" value={formatFixed(shown.saltEquivalentG)} unit="g" />
                </>
              ) : (
                EMPTY_VALUE
              ),
            },
          ]}
        />
      </Stack>
    );
  }

  const ratio = shown ? energyRatio(shown) : null;

  return (
    <Stack gap="5">
      {title || toggle ? (
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          {title ? (
            <chakra.h3 textStyle="heading.card" color="fg.strong">
              {title}
            </chakra.h3>
          ) : null}
          {toggle}
        </Flex>
      ) : null}

      <chakra.dl m="0" display="flex" flexDirection="column" gap="5">
        <Box>
          <chakra.dt textStyle="label" color="fg.muted">
            エネルギー
          </chakra.dt>
          <chakra.dd
            m="0"
            textStyle="stat"
            color={shown ? "fg.strong" : "fg.subtle"}
            whiteSpace="nowrap"
          >
            {formatNumber(shown?.caloriesKcal, 0)}
            {shown ? (
              <chakra.span textStyle="body.sm" color="fg.subtle" ms="1">
                kcal
              </chakra.span>
            ) : null}
          </chakra.dd>
        </Box>

        <Box>
          <chakra.dt srOnly>PFC</chakra.dt>
          <chakra.dd m="0">
            {ratio ? (
              <Flex h="2" borderRadius="l1" overflow="hidden" mb="3" aria-hidden="true">
                <Box w={`${ratio.p}%`} bg={PFC_COLORS.p} />
                <Box w={`${ratio.f}%`} bg={PFC_COLORS.f} />
                <Box w={`${ratio.c}%`} bg={PFC_COLORS.c} />
              </Flex>
            ) : null}
            <Stack gap="0" as="ul" listStyle="none" m="0" p="0">
              {(
                [
                  ["p", "たんぱく質", shown?.proteinG],
                  ["f", "脂質", shown?.fatG],
                  ["c", "炭水化物", shown?.carbohydrateG],
                ] as const
              ).map(([key, label, value]) => (
                <HStack
                  as="li"
                  key={key}
                  justify="space-between"
                  py="1.5"
                  borderBottomWidth="1px"
                  borderColor="border"
                  textStyle="body.sm"
                >
                  <HStack gap="2">
                    <Box boxSize="2" borderRadius="l1" bg={PFC_COLORS[key]} aria-hidden="true" />
                    <chakra.span color="fg.muted">
                      {label}
                      <chakra.span color="fg.subtle" ms="1">
                        {key.toUpperCase()}
                      </chakra.span>
                    </chakra.span>
                  </HStack>
                  <chakra.span
                    fontVariantNumeric="tabular-nums"
                    color="fg.strong"
                    whiteSpace="nowrap"
                  >
                    {formatFixed(value)}
                    <chakra.span color="fg.subtle" ms="0.5">
                      g
                    </chakra.span>
                    {ratio ? (
                      <chakra.span
                        color="fg.subtle"
                        ms="2"
                        display="inline-block"
                        minW="9"
                        textAlign="end"
                      >
                        {Math.round(ratio[key])}%
                      </chakra.span>
                    ) : null}
                  </chakra.span>
                </HStack>
              ))}
              {(
                [
                  ["fiber", "食物繊維", shown?.fiberG],
                  ["salt", "食塩相当量", shown?.saltEquivalentG],
                ] as const
              ).map(([key, label, value]) => (
                <HStack
                  as="li"
                  key={key}
                  justify="space-between"
                  py="1.5"
                  borderBottomWidth="1px"
                  borderColor="border"
                  textStyle="body.sm"
                >
                  <chakra.span color="fg.muted" ps="4">
                    {label}
                  </chakra.span>
                  <chakra.span
                    fontVariantNumeric="tabular-nums"
                    color="fg.strong"
                    whiteSpace="nowrap"
                  >
                    {formatFixed(value)}
                    <chakra.span color="fg.subtle" ms="0.5">
                      g
                    </chakra.span>
                    {ratio ? <chakra.span display="inline-block" minW="9" ms="2" /> : null}
                  </chakra.span>
                </HStack>
              ))}
            </Stack>
          </chakra.dd>
        </Box>

        {costYen !== undefined ? (
          <Box>
            <chakra.dt textStyle="label" color="fg.muted">
              原価
            </chakra.dt>
            <chakra.dd
              m="0"
              textStyle="stat.sm"
              color={shownCost == null ? "fg.subtle" : "fg.strong"}
            >
              {formatYen(shownCost)}
            </chakra.dd>
          </Box>
        ) : null}
      </chakra.dl>
    </Stack>
  );
}
