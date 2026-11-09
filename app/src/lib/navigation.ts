import type { Breadcrumb } from "./breadcrumbs";

/** アプリ内でナビゲーションに出すパス。 */
export type AppPath = "/" | "/dishes" | "/ingredients" | "/settings" | "/license";

export interface NavItem {
  title: string;
  /** アプリ内リンクは `to`、外部リンクは `href` を持つ。 */
  to?: AppPath;
  href?: string;
  /** 現在地判定に使うパスの接頭辞。`/` は完全一致で判定する。 */
  match?: readonly string[];
  opensInNewTab?: boolean;
}

/** ヘッダーの主要ナビゲーション。 */
export const primaryNavigation: readonly NavItem[] = [
  { title: "食事記録", to: "/", match: ["/", "/meals"] },
  { title: "レシピ", to: "/dishes", match: ["/dishes"] },
  { title: "材料", to: "/ingredients", match: ["/ingredients"] },
  { title: "設定", to: "/settings", match: ["/settings"] },
];

/** ヘッダー右側のリソースリンク。 */
export const navigationResources: readonly NavItem[] = [
  { title: "ライセンス", to: "/license", match: ["/license"] },
  { title: "Storybook", href: "/storybook/", opensInNewTab: true },
  { title: "GitHub", href: "https://github.com/Nlkomaru/cho", opensInNewTab: true },
];

export const isNavItemActive = (pathname: string, item: NavItem): boolean =>
  (item.match ?? (item.to ? [item.to] : [])).some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const navItemBreadcrumb = (title: string): Breadcrumb => {
  const item = primaryNavigation.find((entry) => entry.title === title);
  return item?.to ? { label: item.title, to: item.to } : { label: title };
};
