import { ChakraProvider, Box, Link, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { system } from "../../app/theme";

const navigation = [
  { label: "食事記録", href: "/", active: true },
  { label: "レシピ", href: "/dishes" },
  { label: "材料", href: "/ingredients" },
  { label: "設定", href: "/settings" },
] as const;

const resources = [
  { label: "ライセンス", href: "/license" },
  { label: "Storybook", href: "/storybook/" },
  { label: "GitHub", href: "https://github.com/Nlkomaru/cho", external: true },
] as const;

const meta = {
  title: "Navigation/Light App Shell",
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
    <Box display="flex" minH="100vh" bg="bg.canvas">
      <Box
        as="aside"
        aria-label="メインナビゲーション"
        w="16rem"
        flexShrink="0"
        borderRightWidth="1px"
        borderColor="border"
        bg="bg.panel"
        px="4"
        py="6"
      >
        <Stack minH="calc(100vh - 3rem)" gap="8">
          <Link href="/" color="fg.subtle" fontSize="xl" fontWeight="600">
            Cho
          </Link>
          <Box as="nav" aria-label="ページ">
            <Stack as="ul" listStyle="none" gap="1" m="0" p="0">
              {navigation.map(({ label, href, active }) => (
                <Box as="li" key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    display="block"
                    borderRadius="l3"
                    bg={active ? "red.subtle" : "transparent"}
                    color={active ? "red.fg" : "fg"}
                    fontWeight={active ? "600" : "400"}
                    px="3"
                    py="2"
                    _hover={{ bg: "bg.subtle", textDecoration: "none" }}
                  >
                    {label}
                  </Link>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box as="footer" mt="auto" borderTopWidth="1px" borderColor="border" pt="4">
            <Stack as="ul" listStyle="none" gap="1" m="0" p="0">
              {resources.map(({ label, href, external }) => (
                <Box as="li" key={label}>
                  <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    borderRadius="l3"
                    color="fg.muted"
                    fontSize="sm"
                    px="3"
                    py="2"
                    _hover={{ bg: "bg.subtle", textDecoration: "none" }}
                  >
                    {label}
                    {external ? (
                      <Text as="span" aria-hidden="true">
                        ↗
                      </Text>
                    ) : null}
                  </Link>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Box as="section" flex="1" minW="0">
        <Box
          as="header"
          display="flex"
          minH="4rem"
          alignItems="center"
          borderBottomWidth="1px"
          borderColor="border"
          bg="bg.panel"
          px="6"
        >
          <Box as="nav" aria-label="パンくずリスト">
            <Text aria-current="page" color="fg.subtle" fontWeight="600">
              食事記録
            </Text>
          </Box>
        </Box>
        <Box as="main" px="8" py="8">
          <Text color="fg.subtle" fontSize="2xl" fontWeight="600">
            食事記録
          </Text>
        </Box>
      </Box>
    </Box>
  ),
};
