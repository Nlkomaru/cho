import { Box, Button, Drawer, Link, Portal, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import { useRouterState } from "@tanstack/react-router";
import { ExternalLinkIcon, MenuIcon } from "lucide-react";
import { useState } from "react";

import { navItem } from "../../theme/recipes/nav-item";
import { appNav } from "../../theme/slot-recipes/app-nav";

export const navigation = [
  { label: "食事記録", href: "/", match: ["/", "/meals"] },
  { label: "レシピ", href: "/dishes", match: ["/dishes"] },
  { label: "材料", href: "/ingredients", match: ["/ingredients"] },
  { label: "設定", href: "/settings", match: ["/settings"] },
] as const;

export function isNavigationActive(pathname: string, match: readonly string[]) {
  return match.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export const resources = [
  { label: "ライセンス", href: "/license", external: false },
  { label: "Storybook", href: "/storybook/", external: false },
  { label: "GitHub", href: "https://github.com/Nlkomaru/cho", external: true },
] as const;

export function AppNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return <AppNavView pathname={pathname} />;
}

export interface AppNavViewProps {
  pathname: string;
}

/**
 * デスクトップは水平ナビ、モバイルはメニューボタンと Chakra Drawer。
 * 固定サイドバーは持たない。
 */
export function AppNavView({ pathname }: AppNavViewProps) {
  const recipe = useSlotRecipe({ recipe: appNav });
  const navItemRecipe = useRecipe({ recipe: navItem });
  const styles = recipe();
  const [open, setOpen] = useState(false);

  return (
    <Box as="header" css={styles.root}>
      <Box css={styles.inner}>
        <Link href="/" css={styles.brand}>
          Cho
        </Link>
        <Box as="nav" aria-label="ページ" css={styles.primary}>
          {navigation.map(({ label, href, match }) => {
            const active = isNavigationActive(pathname, match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                css={navItemRecipe({ active })}
              >
                {label}
              </Link>
            );
          })}
        </Box>
        <Box as="nav" aria-label="リソース" css={styles.resources}>
          {resources.map(({ label, href, external }) => (
            <Link
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              css={navItemRecipe({ emphasis: "resource" })}
            >
              {label}
              {external ? <ExternalLinkIcon aria-hidden="true" size={13} /> : null}
            </Link>
          ))}
        </Box>
        <Drawer.Root open={open} onOpenChange={(event) => setOpen(event.open)} placement="start">
          <Box css={styles.mobile}>
            <Drawer.Trigger asChild>
              <Button variant="outline" css={styles.menuButton} aria-label="メニューを開く">
                <MenuIcon aria-hidden="true" size={18} />
              </Button>
            </Drawer.Trigger>
          </Box>
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Header>
                  <Drawer.Title textStyle="heading.md">メニュー</Drawer.Title>
                  <Drawer.CloseTrigger asChild>
                    <Button variant="outline" size="sm">
                      閉じる
                    </Button>
                  </Drawer.CloseTrigger>
                </Drawer.Header>
                <Drawer.Body>
                  <Box as="nav" aria-label="ページ">
                    <Box
                      as="ul"
                      listStyle="none"
                      m="0"
                      p="0"
                      display="flex"
                      flexDirection="column"
                      gap="1"
                    >
                      {navigation.map(({ label, href, match }) => {
                        const active = isNavigationActive(pathname, match);
                        return (
                          <Box as="li" key={href}>
                            <Link
                              href={href}
                              aria-current={active ? "page" : undefined}
                              css={navItemRecipe({ active })}
                              onClick={() => setOpen(false)}
                            >
                              {label}
                            </Link>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                  <Box
                    as="footer"
                    marginTop="6"
                    borderTopWidth="1px"
                    borderColor="border"
                    paddingTop="4"
                  >
                    <Box
                      as="ul"
                      listStyle="none"
                      m="0"
                      p="0"
                      display="flex"
                      flexDirection="column"
                      gap="1"
                    >
                      {resources.map(({ label, href, external }) => (
                        <Box as="li" key={label}>
                          <Link
                            href={href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noreferrer" : undefined}
                            css={navItemRecipe({ emphasis: "resource" })}
                          >
                            {label}
                            {external ? <ExternalLinkIcon aria-hidden="true" size={13} /> : null}
                          </Link>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Drawer.Body>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
        </Drawer.Root>
      </Box>
    </Box>
  );
}
