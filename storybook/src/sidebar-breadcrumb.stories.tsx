import { ChakraProvider } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppSidebarView } from "../../app/src/components/app-sidebar";
import { AppHeader } from "../../app/src/components/ui/app-header";
import { Breadcrumb } from "../../app/src/components/ui/breadcrumb";
import { Button, Flex, Box, Text } from "@chakra-ui/react";
import { Page, PageHeader } from "../../app/src/components/ui/page";
import { StatBar } from "../../app/src/components/ui/stat-bar";
import { system } from "../../app/theme";

const meta = {
  title: "App Shell/Light App Shell",
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ChakraProvider value={system}>
        <Story />
      </ChakraProvider>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  render: () => (
    <Flex minH="100vh" bg="bg.canvas">
      <AppSidebarView pathname="/" />
      <Box as="section" flex="1" minW="0">
        <AppHeader>
          <Breadcrumb items={[{ label: "食事記録" }]} />
        </AppHeader>
        <Page size="lg">
          <PageHeader title="食事記録" actions={<Button colorPalette="red">記録を追加</Button>} />
          <StatBar
            label="期間の集計"
            items={[
              { label: "料金", value: "¥1,240" },
              { label: "エネルギー", value: "640 kcal" },
              { label: "PFC", value: "P 24g / F 18g / C 86g" },
              { label: "食物繊維・食塩", value: "食物繊維 4g / 食塩 2g" },
            ]}
          />
          <Text>本文は通常ウェイトの `fg` で表示されます。</Text>
        </Page>
      </Box>
    </Flex>
  ),
};
