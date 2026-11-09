import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { MealPeriod, MealView, Source, Timing } from "@/components/meal/meal-shared";
import { MealToolbar } from "@/components/meal/meal-toolbar";

function ToolbarDemo({ initialSource = "" }: { initialSource?: Source | "" }) {
  const [period, setPeriod] = useState<MealPeriod>("week");
  const [anchor, setAnchor] = useState("2026-11-10");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source | "">(initialSource);
  const [timing, setTiming] = useState<Timing | "">("");
  const [view, setView] = useState<MealView>("cards");
  return (
    <MealToolbar
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
  );
}

const meta = {
  title: "Meal/MealToolbar",
  component: ToolbarDemo,
} satisfies Meta<typeof ToolbarDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filtered: Story = { args: { initialSource: "cafeteria" } };

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
