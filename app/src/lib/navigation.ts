export interface NavItem {
	title: string;
	url: string;
	opensInNewTab?: boolean;
}

export type NavigationGroupTitle = "調理記録" | "マスタ";

export interface NavGroup {
	title: NavigationGroupTitle;
	items: readonly NavItem[];
}

export const navigationGroups: readonly NavGroup[] = [
	{
		title: "調理記録",
		items: [
			{ title: "作った記録", url: "/" },
			{ title: "レシピ", url: "/recipes" },
		],
	},
	{
		title: "マスタ",
		items: [
			{ title: "材料", url: "/ingredients" },
			{ title: "設定", url: "/settings" },
		],
	},
];

export const navigationResources: readonly NavItem[] = [
	{ title: "OSS ライセンス", url: "/license" },
	{
		title: "GitHub",
		url: "https://github.com/Nlkomaru/cho",
		opensInNewTab: true,
	},
	{ title: "Storybook", url: "/storybook", opensInNewTab: true },
];
