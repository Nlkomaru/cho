import { Box, Link, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import { useRouterState } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import { navItem } from "../../theme/recipes/nav-item";
import { sidebar } from "../../theme/slot-recipes/sidebar";

const navigation = [
  { label: "食事記録", href: "/" },
  { label: "レシピ", href: "/dishes" },
  { label: "材料", href: "/ingredients" },
  { label: "設定", href: "/settings" },
] as const;

const resources = [
  { label: "ライセンス", href: "/license", external: false },
  { label: "Storybook", href: "/storybook/", external: false },
  { label: "GitHub", href: "https://github.com/Nlkomaru/cho", external: true },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return <AppSidebarView pathname={pathname} />;
}

export interface AppSidebarViewProps {
  pathname: string;
}

/**
 * ルーター非依存のサイドバー表示。Storybook もこの実体を描画する。
 */
export function AppSidebarView({ pathname }: AppSidebarViewProps) {
  const recipe = useSlotRecipe({ recipe: sidebar });
  const navItemRecipe = useRecipe({ recipe: navItem });
  const styles = recipe();

  return (
    <Box as="aside" aria-label="メインナビゲーション" css={styles.root}>
      <Box css={styles.body}>
        <Link href="/" css={styles.brand}>
          Cho
        </Link>
        <Box as="nav" aria-label="ページ" css={styles.nav}>
          <Box as="ul" css={styles.navList}>
            {navigation.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <Box as="li" key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    css={navItemRecipe({ active: isActive })}
                  >
                    {label}
                  </Link>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box as="footer" css={styles.footer}>
          <Box as="ul" css={styles.resources}>
            {resources.map(({ label, href, external }) => (
              <Box as="li" key={label}>
                <Link
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  css={navItemRecipe({ emphasis: "resource" })}
                >
                  {label}
                  {external ? <ExternalLinkIcon aria-hidden="true" size={14} /> : null}
                </Link>
              </Box>
            ))}
          </Box>
          <Box as="p" css={styles.copyright}>
            © Cho
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
