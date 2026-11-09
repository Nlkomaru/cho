import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Page } from "@/components/layout/page";
import { MealDetailView } from "@/components/meal/meal-detail-view";
import { MealListView } from "@/components/meal/meal-list-view";
import type { Meal, MealPeriod, MealView, Source, Timing } from "@/components/meal/meal-shared";

import { curryMeal, photoSrc, weekMeals } from "./fixtures";

function ListPage({
  meals,
  initialView = "cards",
}: {
  meals: readonly Meal[];
  initialView?: MealView;
}) {
  const [period, setPeriod] = useState<MealPeriod>("week");
  const [anchor, setAnchor] = useState("2026-11-10");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "">("");
  const [timing, setTiming] = useState<Timing | "">("");
  const [view, setView] = useState<MealView>(initialView);
  return (
    <Page>
      <MealListView
        meals={meals}
        onAdd={() => undefined}
        period={period}
        onPeriodChange={setPeriod}
        anchor={anchor}
        onAnchorChange={setAnchor}
        query={query}
        onQueryChange={setQuery}
        source={source}
        onSourceChange={setSource}
        timing={timing}
        onTimingChange={setTiming}
        view={view}
        onViewChange={setView}
      />
    </Page>
  );
}

const meta = {
  title: "Meal/Page",
  component: ListPage,
  args: { meals: weekMeals },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const ListTable: Story = { args: { initialView: "table" } };

export const ListEmpty: Story = { args: { meals: [] } };

export const ListMobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

const detailMeal: Meal = { ...curryMeal, imageIds: ["20", "140"] };

function DetailPage() {
  return (
    <Page>
      <MealDetailView
        meal={detailMeal}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onConsumeStock={() => undefined}
        resolveImageSrc={(id) => photoSrc(Number(id))}
      />
    </Page>
  );
}

export const Detail: Story = { render: () => <DetailPage /> };

export const DetailMobile: Story = {
  render: () => <DetailPage />,
  globals: { viewport: { value: "mobile", isRotated: false } },
};
