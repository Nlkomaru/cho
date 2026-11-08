import { Box, Button, chakra, Flex, Table, Text } from "@chakra-ui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { Feedback } from "../../components/ui/feedback";
import { Numeric } from "../../components/ui/numeric";
import { Page, PageHeader } from "../../components/ui/page";
import { StatBar } from "../../components/ui/stat-bar";
import { MealEntryDrawer } from "./-components/meal-entry-drawer";
import { MealFilters } from "./-components/meal-filters";
import { MealJournal } from "./-components/meal-journal";
import {
  api,
  currency,
  fmt,
  localCalendarDate,
  localTimeValue,
  sourceName,
  type Meal,
  type MealListResponse,
  type Source,
  type Timing,
} from "./-components/meal-shared";
import { NutritionLine } from "./-components/nutrition-line";

const mealSearchSchema = z.object({
  dishId: z.string().trim().min(1).optional(),
  servings: z.coerce.number().positive().finite().optional(),
});

export const Route = createFileRoute("/_app/")({
  validateSearch: mealSearchSchema,
  staticData: { breadcrumbs: [{ label: "食事記録" }] },
  component: MealListPage,
});

function MealListPage() {
  const search = Route.useSearch();
  const requestedDishId = search.dishId;
  const requestedServings = search.servings ?? 1;
  const [open, setOpen] = useState(Boolean(requestedDishId));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<MealListResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [source, setSource] = useState<Source | "">("");
  const [timing, setTiming] = useState<Timing | "">("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (source) params.set("sourceType", source);
    if (timing) params.set("mealTiming", timing);
    if (query.trim()) params.set("q", query.trim());
    if (date) params.set("date", date);
    const suffix = params.size ? `?${params}` : "";
    try {
      const result = await api<MealListResponse>(`/api/meals${suffix}`);
      setMeals(result.meals);
      setSummary(result.summary);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "食事記録を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [source, timing, query, date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = summary?.[period] ?? null;

  return (
    <Page size="lg">
      <PageHeader
        title="食事記録"
        actions={
          <Button colorPalette="red" onClick={() => setOpen(true)}>
            記録を追加
          </Button>
        }
      />
      <Flex gap="2" aria-label="集計期間">
        {(
          [
            ["day", "日"],
            ["week", "週"],
            ["month", "月"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={period === key ? "outline" : "ghost"}
            colorPalette={period === key ? "red" : "gray"}
            onClick={() => setPeriod(key)}
          >
            {label}
          </Button>
        ))}
      </Flex>
      <StatBar
        label="期間の集計"
        items={[
          {
            label: "料金",
            value: (
              <Numeric size="lg" tone="strong">
                {currency(totals?.priceYen)}
              </Numeric>
            ),
          },
          {
            label: "エネルギー",
            value: (
              <>
                <Numeric size="lg" tone="strong">
                  {fmt(totals?.caloriesKcal)}
                </Numeric>
                <Box as="span">kcal</Box>
              </>
            ),
          },
          {
            label: "PFC",
            value: (
              <>
                <Box as="span">
                  P{" "}
                  <Numeric size="lg" tone="strong">
                    {fmt(totals?.proteinG)}
                  </Numeric>{" "}
                  g
                </Box>
                <Box as="span">
                  F{" "}
                  <Numeric size="lg" tone="strong">
                    {fmt(totals?.fatG)}
                  </Numeric>{" "}
                  g
                </Box>
                <Box as="span">
                  C{" "}
                  <Numeric size="lg" tone="strong">
                    {fmt(totals?.carbohydrateG)}
                  </Numeric>{" "}
                  g
                </Box>
              </>
            ),
          },
          {
            label: "食物繊維・食塩",
            value: (
              <>
                <Box as="span">
                  食物繊維{" "}
                  <Numeric size="lg" tone="strong">
                    {fmt(totals?.fiberG)}
                  </Numeric>{" "}
                  g
                </Box>
                <Box as="span">
                  食塩{" "}
                  <Numeric size="lg" tone="strong">
                    {fmt(totals?.saltEquivalentG)}
                  </Numeric>{" "}
                  g
                </Box>
              </>
            ),
          },
        ]}
      />
      <MealFilters
        source={source}
        onSource={setSource}
        timing={timing}
        onTiming={setTiming}
        query={query}
        onQuery={setQuery}
        date={date}
        onDate={setDate}
        view={view}
        onView={setView}
      />
      {error ? (
        <Feedback tone="error" role="alert">
          {error}{" "}
          <Button variant="outline" onClick={() => void refresh()}>
            再読み込み
          </Button>
        </Feedback>
      ) : null}
      {loading ? (
        <Feedback tone="status" role="status">
          読み込み中
        </Feedback>
      ) : meals.length === 0 ? (
        <Text>該当する食事記録はありません。</Text>
      ) : view === "table" ? (
        <MealTable meals={meals} />
      ) : (
        <MealJournal meals={meals} />
      )}
      <MealEntryDrawer
        open={open}
        initialDishId={requestedDishId}
        initialServings={requestedServings}
        close={() => {
          setOpen(false);
          void refresh();
        }}
        saved={async () => {
          setOpen(false);
          await refresh();
        }}
      />
    </Page>
  );
}

function MealTable({ meals }: { meals: readonly Meal[] }) {
  return (
    <Table.ScrollArea borderWidth="0">
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>日時</Table.ColumnHeader>
            <Table.ColumnHeader>区分</Table.ColumnHeader>
            <Table.ColumnHeader>料理名</Table.ColumnHeader>
            <Table.ColumnHeader>料金</Table.ColumnHeader>
            <Table.ColumnHeader>栄養価</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {meals.map((meal) => (
            <Table.Row key={meal.id}>
              <Table.Cell whiteSpace="nowrap">
                <Numeric size="sm" tone="muted">
                  {localCalendarDate(meal.eatenAt)} {localTimeValue(meal.eatenAt)}
                </Numeric>
              </Table.Cell>
              <Table.Cell>{sourceName[meal.sourceType]}</Table.Cell>
              <Table.Cell>
                <Flex align="center" gap="2" minW="0">
                  {meal.imageIds[0] ? (
                    <chakra.img
                      src={`/api/images/${encodeURIComponent(meal.imageIds[0])}`}
                      alt={`${meal.title}の写真`}
                      width="8"
                      height="8"
                      borderRadius="l3"
                      objectFit="cover"
                      flexShrink="0"
                    />
                  ) : null}
                  <Link to="/meals/$mealId" params={{ mealId: meal.id }}>
                    {meal.title}
                  </Link>
                </Flex>
              </Table.Cell>
              <Table.Cell whiteSpace="nowrap">
                <Numeric size="sm">{currency(meal.totalPriceYen)}</Numeric>
              </Table.Cell>
              <Table.Cell>
                <NutritionLine nutrition={meal.totalNutrition} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  );
}
