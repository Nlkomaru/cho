import type { Meta, StoryObj } from "@storybook/react-vite";

import { LicenseGroup } from "@/routes/_app/license/-components/license-group";

import { buildPackage, mitPackages } from "./fixtures";

const meta = {
  title: "License/LicenseGroup",
  component: LicenseGroup,
  args: { license: "MIT", packages: mitPackages },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 960 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LicenseGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mit: Story = {};

export const WithoutBundledText: Story = {
  args: {
    license: "MPL-2.0",
    packages: [
      buildPackage({
        name: "lightningcss",
        versions: ["1.30.2"],
        author: "Devon Govett",
        homepage: "https://lightningcss.dev",
      }),
    ],
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};
