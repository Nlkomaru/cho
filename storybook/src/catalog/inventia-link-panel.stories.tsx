import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { InventiaLinkPanel } from "@/routes/_app/ingredients/-components/inventia-link-panel";

import { fakeInventiaActions, ingredients, inventiaMatches } from "./fixtures";

const onion = ingredients[0];
const potato = ingredients[1];

const meta = {
  title: "Catalog/InventiaLinkPanel",
  component: InventiaLinkPanel,
  decorators: [
    (Story) => (
      <Box maxW="592px">
        <Story />
      </Box>
    ),
  ],
  args: { ingredient: onion, actions: fakeInventiaActions },
} satisfies Meta<typeof InventiaLinkPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Linked: Story = {
  args: { initialStock: { found: true, currentQuantity: 1200, baseUnit: "g" } },
};

export const Unlinked: Story = { args: { ingredient: potato } };

export const SearchResults: Story = {
  args: { ingredient: potato, initialMatches: inventiaMatches },
};

export const NoResults: Story = { args: { ingredient: potato, initialMatches: [] } };
