import { Badge, Box, Grid, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { AppShell } from "@/components/layout/app-shell";
import { MetaSeparator, PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/layout/page";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { StatGroup } from "@/components/ui/stat-group";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: { pathname: "/", children: null },
  render: (args) => (
    <AppShell {...args}>
      <Page>
        <PageHeader
          title="食事記録"
          actions={
            <Button variant="primary">
              <Plus />
              記録を追加
            </Button>
          }
        />
        <StatGroup
          label="期間の集計"
          items={[
            { label: "料金", value: "¥1,240" },
            { label: "エネルギー", value: "1,830", unit: "kcal" },
            { label: "たんぱく質", value: "74.2", unit: "g" },
            { label: "食塩", value: "8.1", unit: "g" },
          ]}
        />
        <Section title="11月10日(火)" meta="¥1,240 · 1,830 kcal">
          <Grid gap="0">
            {["18:30 ポークカレー", "12:10 日替わり定食"].map((row) => (
              <Box key={row} py="4" borderBottomWidth="1px" borderColor="border">
                <Text color="fg.strong" fontWeight="500">
                  {row}
                </Text>
              </Box>
            ))}
          </Grid>
        </Section>
      </Page>
    </AppShell>
  ),
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Meals: Story = {};

export const Recipes: Story = {
  args: { pathname: "/dishes/85b51773" },
  parameters: { router: { path: "/dishes/85b51773" } },
  render: (args) => (
    <AppShell {...args}>
      <Page>
        <PageHeader
          size="display"
          title="ポークカレー"
          breadcrumbs={[{ label: "レシピ", to: "/dishes" }]}
          meta={
            <>
              <Badge>主菜</Badge>
              <span>基準 4人前</span>
              <MetaSeparator />
              <span>調理 52分</span>
            </>
          }
          actions={
            <>
              <Button variant="outline">編集</Button>
              <Button variant="primary">食事記録に追加</Button>
            </>
          }
        />
      </Page>
    </AppShell>
  ),
};

export const Ingredients: Story = {
  args: { pathname: "/ingredients" },
  parameters: { router: { path: "/ingredients" } },
};

export const Settings: Story = {
  args: { pathname: "/settings" },
  parameters: { router: { path: "/settings" } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

export const MobileMenuOpen: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  args: { pathname: "/dishes" },
  parameters: { router: { path: "/dishes" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "メニュー" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
  },
};
