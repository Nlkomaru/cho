import { Box, Link, Stack, Text } from "@chakra-ui/react";
import { useRouterState } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

const navigation = [
  { label: "食事記録", href: "/" },
  { label: "レシピ", href: "/dishes" },
  { label: "材料", href: "/ingredients" },
  { label: "設定", href: "/settings" },
] as const;

const resources = [
  { label: "ライセンス", href: "/license" },
  { label: "Storybook", href: "/storybook/" },
  { label: "GitHub", href: "https://github.com/Nlkomaru/cho", external: true },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <Box
      as="aside"
      aria-label="メインナビゲーション"
      w="16rem"
      minH="100vh"
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
            {navigation.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <Box as="li" key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    display="block"
                    borderRadius="l3"
                    bg={isActive ? "red.subtle" : "transparent"}
                    color={isActive ? "red.fg" : "fg"}
                    fontWeight={isActive ? "600" : "400"}
                    px="3"
                    py="2"
                    _hover={{ bg: "bg.subtle", textDecoration: "none" }}
                  >
                    {label}
                  </Link>
                </Box>
              );
            })}
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
                  {external ? <ExternalLinkIcon aria-hidden="true" size={14} /> : null}
                </Link>
              </Box>
            ))}
          </Stack>
          <Text mt="3" px="3" color="fg.muted" fontSize="xs">
            © Cho
          </Text>
        </Box>
      </Stack>
    </Box>
  );
}
