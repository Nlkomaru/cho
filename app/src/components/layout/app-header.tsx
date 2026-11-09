import { Box, chakra, useSlotRecipe } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { CookingPot, Menu } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { GitHubIcon } from "@/components/ui/github-icon";
import { isNavItemActive, navigationResources, primaryNavigation } from "@/lib/navigation";

import { appHeaderSlotRecipe } from "../../../theme/slot-recipes/app-header";
import { MobileNav } from "./mobile-nav";

export interface AppHeaderProps {
  pathname: string;
}

/*
 * TanStack の Link は現在地と一致すると aria-current="page" を自動で付ける。
 * 現在地の判定は isNavItemActive に揃えたいので、Link 側は完全一致だけにする。
 */

/**
 * 上部ヘッダー。左にロゴ、主要ナビ、右にリソースリンク。md 未満はメニューボタン。
 */
export function AppHeader({ pathname }: AppHeaderProps) {
  const recipe = useSlotRecipe({ recipe: appHeaderSlotRecipe });
  const styles = recipe();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Box as="header" css={styles.root}>
      <Box css={styles.inner}>
        <chakra.a asChild css={styles.brand}>
          <Link to="/" activeOptions={{ exact: true }} aria-label="Cho 食事記録へ">
            <Box as="span" css={styles.mark}>
              <CookingPot size={16} strokeWidth={1.75} aria-hidden="true" />
            </Box>
            <Box as="span" css={styles.wordmark}>
              Cho
            </Box>
          </Link>
        </chakra.a>

        <Box as="nav" aria-label="メイン" css={styles.nav}>
          {primaryNavigation.map((item) =>
            item.to ? (
              <chakra.a key={item.to} asChild css={styles.navItem}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: true }}
                  aria-current={isNavItemActive(pathname, item) ? "page" : undefined}
                >
                  {item.title}
                </Link>
              </chakra.a>
            ) : null,
          )}
        </Box>

        <Box as="nav" aria-label="リソース" css={styles.resources}>
          {navigationResources.map((item) => {
            if (item.to) {
              return (
                <chakra.a key={item.title} asChild css={styles.resourceItem}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: true }}
                    aria-current={isNavItemActive(pathname, item) ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                </chakra.a>
              );
            }
            if (item.title === "GitHub") {
              return (
                <IconButton
                  key={item.title}
                  asChild
                  variant="ghost"
                  size="sm"
                  aria-label="GitHub (新しいタブで開く)"
                >
                  <a href={item.href} target="_blank" rel="noreferrer">
                    <GitHubIcon />
                  </a>
                </IconButton>
              );
            }
            return (
              <chakra.a
                key={item.title}
                href={item.href}
                target={item.opensInNewTab ? "_blank" : undefined}
                rel={item.opensInNewTab ? "noreferrer" : undefined}
                css={styles.resourceItem}
              >
                {item.title}
              </chakra.a>
            );
          })}
        </Box>

        <IconButton
          variant="ghost"
          size="md"
          aria-label="メニュー"
          aria-expanded={menuOpen}
          css={styles.menuButton}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} strokeWidth={1.75} />
        </IconButton>
      </Box>
      <MobileNav pathname={pathname} open={menuOpen} onOpenChange={setMenuOpen} />
    </Box>
  );
}
