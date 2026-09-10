/**
 * パンくずの 1 段。`to` を持つ段はリンクになり、末尾は現在地として描く。
 */
export interface Breadcrumb {
	label: string;
	to?: string;
}

/**
 * 各 route が名乗るパンくず。表示順は一致した route の階層で自動的に決まる。
 * loader が返す場合は、動的な名前や祖先を表示できる。
 */
export interface BreadcrumbsLoaderData {
	breadcrumbs: readonly Breadcrumb[];
}

const isBreadcrumb = (value: unknown): value is Breadcrumb => {
	if (typeof value !== "object" || value === null || !("label" in value)) {
		return false;
	}
	const label = value.label;
	if (typeof label !== "string") {
		return false;
	}
	if (!("to" in value)) {
		return true;
	}
	const to = value.to;
	return to === undefined || typeof to === "string";
};

export const breadcrumbsFromLoaderData = (
	loaderData: unknown,
): readonly Breadcrumb[] | null => {
	if (
		typeof loaderData !== "object" ||
		loaderData === null ||
		!("breadcrumbs" in loaderData)
	) {
		return null;
	}
	const candidate = loaderData.breadcrumbs;
	if (!Array.isArray(candidate) || !candidate.every(isBreadcrumb)) {
		return null;
	}
	return candidate;
};
