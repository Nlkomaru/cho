import type { Breadcrumb } from "./breadcrumbs";

export interface NavItem {
	title: string;
	url: string;
}

export type NavigationGroupTitle = "調理記録";

export interface NavGroup {
	title: NavigationGroupTitle;
	items: readonly NavItem[];
}

export const navigationGroups: readonly NavGroup[] = [
	{
		title: "調理記録",
		items: [{ title: "記録一覧", url: "/" }],
	},
];

export const groupBreadcrumb = (title: NavigationGroupTitle): Breadcrumb => {
	const group = navigationGroups.find((entry) => entry.title === title);
	const landing = group?.items[0];
	return landing ? { label: title, to: landing.url } : { label: title };
};
