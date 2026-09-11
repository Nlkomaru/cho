import { createFileRoute, Link } from "@tanstack/react-router";
import { UtensilsCrossedIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatJstDate } from "@/lib/datetime";
import { fetchCategories, fetchRecipes } from "@/server/recipes.functions";

/** 種類での絞り込み。未指定なら URL に載せない */
interface RecipeListSearch {
	category?: string;
}

export const Route = createFileRoute("/_app/recipes/")({
	staticData: {
		breadcrumbs: [{ label: "レシピ" }],
	},
	validateSearch: (search: Record<string, unknown>): RecipeListSearch =>
		typeof search.category === "string" && search.category.length > 0
			? { category: search.category }
			: {},
	loader: async () => {
		const [recipes, categories] = await Promise.all([
			fetchRecipes(),
			fetchCategories(),
		]);
		return { recipes, categories };
	},
	component: RecipeList,
});

const allCategories = "__all__";

function RecipeList() {
	const { recipes, categories } = Route.useLoaderData();
	const { category } = Route.useSearch();
	const navigate = Route.useNavigate();
	const visible = category
		? recipes.filter((recipe) => recipe.categorySlug === category)
		: recipes;
	const categoryItems: Record<string, string> = {
		[allCategories]: "すべて",
		...Object.fromEntries(categories.map((entry) => [entry.slug, entry.name])),
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">レシピ</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						レシピを登録しておくと、作った記録から何度でも振り返れます。
					</p>
				</div>
				<Button render={<Link to="/recipes/new" />}>
					<UtensilsCrossedIcon />
					レシピを追加
				</Button>
			</div>

			{categories.length > 0 ? (
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">種類</span>
					<Select
						items={categoryItems}
						onValueChange={(value) =>
							void navigate({
								search: {
									category: value === allCategories ? undefined : String(value),
								},
								replace: true,
							})
						}
						value={category ?? allCategories}
					>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={allCategories}>すべて</SelectItem>
							{categories.map((entry) => (
								<SelectItem key={entry.id} value={entry.slug}>
									{entry.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}

			{visible.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>レシピがまだありません</CardTitle>
						<CardDescription>
							{recipes.length === 0
								? "作った料理やお菓子のレシピを登録してください。レシピ JSON を貼り付けて取り込むこともできます。"
								: "この種類のレシピはまだありません。"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button render={<Link to="/recipes/new" />} variant="outline">
							レシピを追加
						</Button>
					</CardContent>
				</Card>
			) : (
				<ul className="grid gap-4 sm:grid-cols-2">
					{visible.map((recipe) => (
						<li key={recipe.id}>
							<Card className="h-full">
								<CardHeader>
									<div className="flex items-start justify-between gap-2">
										<CardTitle>
											<Link
												className="hover:underline"
												params={{ recipeId: recipe.id }}
												to="/recipes/$recipeId"
											>
												{recipe.title}
											</Link>
										</CardTitle>
										<Badge variant="secondary">{recipe.categoryName}</Badge>
									</div>
									<CardDescription>
										{recipe.summary ?? "説明はありません。"}
									</CardDescription>
								</CardHeader>
								<CardContent className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
									<span>
										{recipe.latestCookedAt === null
											? "まだ作っていません"
											: `最後に作った日: ${formatJstDate(recipe.latestCookedAt)}`}
									</span>
									<span>記録 {recipe.cookCount} 件</span>
									{recipe.tags.length > 0 ? (
										<span>{recipe.tags.join("・")}</span>
									) : null}
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
