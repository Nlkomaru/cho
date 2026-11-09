import type { Meta, StoryObj } from "@storybook/react-vite";

import { LicenseView } from "@/routes/_app/license/-components/license-view";

import { groups } from "./fixtures";

const meta = {
  title: "License/Page",
  component: LicenseView,
  args: { groups },
  parameters: { layout: "fullscreen", router: { path: "/license" } },
} satisfies Meta<typeof LicenseView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Filtered: Story = {
  args: { initialQuery: "tan" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const NoMatch: Story = {
  args: { initialQuery: "存在しない" },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
