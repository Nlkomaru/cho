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

/** 価格記録のない品目と連携した直後。連携は保存され、単価は未登録のまま。 */
export const LinkedWithoutPrice: Story = {
  args: {
    ingredient: {
      ...onion,
      inventiaItemId: "itm_01JD8ONION",
      latestUnitPriceYen: null,
      latestPriceUpdatedAt: null,
    },
  },
};

/** 価格記録がないことを確認済み (日付はその確認日)。 */
export const LinkedWithoutPriceChecked: Story = {
  args: {
    ingredient: {
      ...onion,
      inventiaItemId: "itm_01JD8ONION",
      latestUnitPriceYen: null,
      latestPriceUpdatedAt: "2026-11-10T03:00:00.000Z",
    },
  },
};
