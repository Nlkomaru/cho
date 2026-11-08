import { Box, Button, ChakraProvider, Flex, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppNavView } from "../../app/src/components/app-nav";
import { Numeric } from "../../app/src/components/ui/numeric";
import { Page, PageHeader } from "../../app/src/components/ui/page";
import { StatBar } from "../../app/src/components/ui/stat-bar";
import { system } from "../../app/theme";

const meta = {
  title: "App Shell/Horizontal Nav",
  parameters: { layout: "fullscreen" },
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

export const MealList: Story = {
  render: () => (
    <Flex minH="100vh" direction="column" bg="bg.canvas">
      <AppNavView pathname="/meals/demo" />
      <Page size="lg">
        <PageHeader title="食事記録" actions={<Button colorPalette="red">記録を追加</Button>} />
        <StatBar
          label="期間の集計"
          items={[
            {
              label: "料金",
              value: (
                <Numeric size="lg" tone="strong">
                  ¥1,400
                </Numeric>
              ),
            },
            {
              label: "エネルギー",
              value: (
                <>
                  <Numeric size="lg" tone="strong">
                    1,200
                  </Numeric>
                  <Box as="span">kcal</Box>
                </>
              ),
            },
            {
              label: "PFC",
              value: (
                <Box as="span">
                  P{" "}
                  <Numeric size="lg" tone="strong">
                    74
                  </Numeric>{" "}
                  g
                </Box>
              ),
            },
            {
              label: "食物繊維・食塩",
              value: (
                <Box as="span">
                  食塩{" "}
                  <Numeric size="lg" tone="strong">
                    4.9
                  </Numeric>{" "}
                  g
                </Box>
              ),
            },
          ]}
        />
        <Text>本文は通常ウェイトの fg で表示されます。</Text>
      </Page>
    </Flex>
  ),
};
