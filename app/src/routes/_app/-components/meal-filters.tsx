import { Box, Field, Flex, Input, Tabs } from "@chakra-ui/react";

import { DateField } from "../../../components/ui/date-field";
import { SelectField } from "../../../components/ui/select-field";
import { sources, timings, type Source, type Timing } from "./meal-shared";

const sourceOptions = sources.map(([value, label]) => ({ value, label }));
const timingOptions = timings.map(([value, label]) => ({ value, label }));

export interface MealFiltersProps {
  source: Source | "";
  onSource: (value: Source | "") => void;
  timing: Timing | "";
  onTiming: (value: Timing | "") => void;
  query: string;
  onQuery: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  view: "cards" | "table";
  onView: (value: "cards" | "table") => void;
}

export function MealFilters({
  source,
  onSource,
  timing,
  onTiming,
  query,
  onQuery,
  date,
  onDate,
  view,
  onView,
}: MealFiltersProps) {
  return (
    <Flex gap="3" wrap="wrap" align="flex-end">
      <Box flex={{ base: "1 1 100%", sm: "1 1 9rem" }}>
        <SelectField
          label="区分"
          value={source}
          onChange={(value) => onSource(value as Source | "")}
          options={sourceOptions}
          placeholder="すべて"
        />
      </Box>
      <Box flex={{ base: "1 1 100%", sm: "1 1 9rem" }}>
        <SelectField
          label="食事区分"
          value={timing}
          onChange={(value) => onTiming(value as Timing | "")}
          options={timingOptions}
          placeholder="すべて"
        />
      </Box>
      <Box flex={{ base: "1 1 100%", sm: "1 1 12rem" }}>
        <Field.Root>
          <Field.Label>料理名・場所</Field.Label>
          <Input
            aria-label="料理名・場所で検索"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </Field.Root>
      </Box>
      <Box flex={{ base: "1 1 100%", sm: "1 1 12rem" }}>
        <DateField label="日付" value={date} onChange={onDate} />
      </Box>
      <Tabs.Root
        value={view}
        onValueChange={(details) => onView(details.value as "cards" | "table")}
        size="sm"
      >
        <Tabs.List>
          <Tabs.Trigger value="cards">カード</Tabs.Trigger>
          <Tabs.Trigger value="table">表</Tabs.Trigger>
          <Tabs.Indicator />
        </Tabs.List>
      </Tabs.Root>
    </Flex>
  );
}
