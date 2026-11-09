import { Badge, Box, Flex, Grid, Popover, Portal, Stack, chakra } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, LayoutList, SlidersHorizontal, Table2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";

import {
  localCalendarDate,
  periodLabel,
  shiftAnchor,
  sourceOptions,
  timingOptions,
  type MealPeriod,
  type MealView,
  type Source,
  type Timing,
} from "./meal-shared";

export interface MealToolbarProps {
  period: MealPeriod;
  onPeriodChange(period: MealPeriod): void;
  /** 期間の基準日 `YYYY-MM-DD`。 */
  anchor: string;
  onAnchorChange(anchor: string): void;
  query: string;
  onQueryChange(query: string): void;
  source: Source | "";
  onSourceChange(source: Source | ""): void;
  timing: Timing | "";
  onTimingChange(timing: Timing | ""): void;
  view: MealView;
  onViewChange(view: MealView): void;
}

const periodItems = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
] as const;

const viewLabel = (icon: ReactNode, text: string) => (
  <chakra.span display="inline-flex" alignItems="center" gap="1.5">
    {icon}
    <chakra.span srOnly={{ base: true, sm: false }}>{text}</chakra.span>
  </chakra.span>
);

const viewItems = [
  {
    value: "cards",
    label: viewLabel(<LayoutList strokeWidth={1.75} aria-hidden="true" />, "カード"),
  },
  { value: "table", label: viewLabel(<Table2 strokeWidth={1.75} aria-hidden="true" />, "表") },
] as const;

/**
 * 食事記録の操作列。左に期間 (日/週/月 + 基準日)、右に検索・絞り込み・表示切り替え。
 */
export function MealToolbar({
  period,
  onPeriodChange,
  anchor,
  onAnchorChange,
  query,
  onQueryChange,
  source,
  onSourceChange,
  timing,
  onTimingChange,
  view,
  onViewChange,
}: MealToolbarProps) {
  const activeFilters = (source ? 1 : 0) + (timing ? 1 : 0);

  return (
    <Grid
      role="toolbar"
      aria-label="表示する期間と条件"
      templateColumns={{
        base: "minmax(0, 1fr) auto",
        lg: "auto minmax(0, 1fr) minmax(160px, 240px) auto auto",
      }}
      templateAreas={{
        base: `"period view" "date date" "search filter"`,
        lg: `"period date search filter view"`,
      }}
      alignItems="center"
      columnGap={{ base: "3", lg: "4" }}
      rowGap="3"
    >
      <Box gridArea="period">
        <SegmentedControl
          label="集計期間"
          value={period}
          onChange={onPeriodChange}
          items={periodItems}
        />
      </Box>
      <Flex gridArea="date" align="center" columnGap="3" rowGap="1" wrap="wrap" minW="0">
        <Flex align="center" gap="1">
          <IconButton
            aria-label="前の期間"
            variant="ghost"
            size="sm"
            disabled={!anchor}
            onClick={() => onAnchorChange(shiftAnchor(period, anchor, -1))}
          >
            <ChevronLeft strokeWidth={1.75} />
          </IconButton>
          <Box w="48">
            <DateField
              label="基準日"
              hideLabel
              size="sm"
              value={anchor}
              onChange={(value) => onAnchorChange(value || localCalendarDate(new Date()))}
            />
          </Box>
          <IconButton
            aria-label="次の期間"
            variant="ghost"
            size="sm"
            disabled={!anchor}
            onClick={() => onAnchorChange(shiftAnchor(period, anchor, 1))}
          >
            <ChevronRight strokeWidth={1.75} />
          </IconButton>
        </Flex>
        {period === "day" || !anchor ? null : (
          <chakra.span
            textStyle="body.sm"
            color="fg.muted"
            fontVariantNumeric="tabular-nums"
            whiteSpace="nowrap"
          >
            {periodLabel(period, anchor)}
          </chakra.span>
        )}
      </Flex>
      <Box gridArea="search" minW="0">
        <SearchInput
          label="料理名・場所で検索"
          placeholder="料理名・場所"
          value={query}
          onChange={onQueryChange}
        />
      </Box>
      <Box gridArea="filter">
        <Popover.Root positioning={{ placement: "bottom-end" }}>
          <Popover.Trigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal strokeWidth={1.75} />
              絞り込み
              {activeFilters ? (
                <Badge
                  colorPalette="navy"
                  variant="solid"
                  borderRadius="full"
                  h="5"
                  minW="5"
                  px="1.5"
                  justifyContent="center"
                  aria-label={`${activeFilters}件の条件`}
                >
                  {activeFilters}
                </Badge>
              ) : null}
            </Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content w="72">
                <Popover.Body>
                  <Stack gap="4">
                    <Field label="区分">
                      <NativeSelect
                        size="sm"
                        value={source}
                        placeholder="すべて"
                        options={sourceOptions}
                        onChange={(value) => onSourceChange(value as Source | "")}
                      />
                    </Field>
                    <Field label="食事区分">
                      <NativeSelect
                        size="sm"
                        value={timing}
                        placeholder="すべて"
                        options={timingOptions}
                        onChange={(value) => onTimingChange(value as Timing | "")}
                      />
                    </Field>
                    {activeFilters ? (
                      <Button
                        variant="link"
                        size="sm"
                        alignSelf="flex-start"
                        onClick={() => {
                          onSourceChange("");
                          onTimingChange("");
                        }}
                      >
                        条件をクリア
                      </Button>
                    ) : null}
                  </Stack>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </Box>
      <Box gridArea="view" justifySelf="end">
        <SegmentedControl label="表示形式" value={view} onChange={onViewChange} items={viewItems} />
      </Box>
    </Grid>
  );
}
