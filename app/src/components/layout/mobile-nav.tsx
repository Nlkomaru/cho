import { Box, CloseButton, Drawer, Portal, chakra } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import {
  isNavItemActive,
  navigationResources,
  primaryNavigation,
  type NavItem,
} from "@/lib/navigation";

export interface MobileNavProps {
  pathname: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

const rowStyles = {
  display: "flex",
  alignItems: "center",
  gap: "2",
  minH: "12",
  px: "4",
  borderBottomWidth: "1px",
  borderColor: "border",
  fontSize: "15px",
  _focusVisible: { outline: "2px solid {colors.navy.900}", outlineOffset: "-2px" },
} as const;

/**
 * md 未満のナビゲーション。右から開くドロワーに主要ナビとリソースを並べる。
 */
export function MobileNav({ pathname, open, onOpenChange }: MobileNavProps) {
  const close = () => onOpenChange(false);

  const renderItem = (item: NavItem, tone: "primary" | "resource") => {
    const active = isNavItemActive(pathname, item);
    const css = {
      ...rowStyles,
      fontWeight: tone === "primary" ? "500" : "400",
      color: active ? "fg.strong" : "fg.muted",
      boxShadow: active ? "inset 2px 0 0 {colors.red.600}" : "none",
      _hover: { bg: "navy.50", color: "fg.strong" },
    };
    if (item.to) {
      return (
        <chakra.a asChild css={css}>
          <Link
            to={item.to}
            activeOptions={{ exact: true }}
            aria-current={active ? "page" : undefined}
            onClick={close}
          >
            {item.title}
          </Link>
        </chakra.a>
      );
    }
    return (
      <chakra.a
        href={item.href}
        target={item.opensInNewTab ? "_blank" : undefined}
        rel={item.opensInNewTab ? "noreferrer" : undefined}
        css={css}
      >
        {item.title}
        {item.opensInNewTab ? (
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
        ) : null}
      </chakra.a>
    );
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      placement="end"
      size="xs"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>メニュー</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body px="0" py="0" gap="0">
              <Box as="nav" aria-label="メイン">
                <chakra.ul
                  listStyle="none"
                  m="0"
                  p="0"
                  css={{ "& > li:last-of-type > a": { borderBottomWidth: "0" } }}
                >
                  {primaryNavigation.map((item) => (
                    <li key={item.title}>{renderItem(item, "primary")}</li>
                  ))}
                </chakra.ul>
              </Box>
              <Box as="nav" aria-label="リソース" mt="6" borderTopWidth="1px" borderColor="border">
                <chakra.ul listStyle="none" m="0" p="0">
                  {navigationResources.map((item) => (
                    <li key={item.title}>{renderItem(item, "resource")}</li>
                  ))}
                </chakra.ul>
              </Box>
            </Drawer.Body>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" variant="ghost" aria-label="メニューを閉じる" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
