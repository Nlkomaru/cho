import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { fetchRecipes } from "@/server/recipes.functions";
import { CookForm } from "./-components/cook-form";

export const Route = createFileRoute("/_app/cooks/new")({
	staticData: {
		breadcrumbs: [{ label: "作った記録", to: "/" }, { label: "記録を追加" }],
	},
	validateSearch: (search: Record<string, unknown>): { recipeId?: string } =>
		typeof search.recipeId === "string" && search.recipeId.length > 0
			? { recipeId: search.recipeId }
			: {},
	loader: async () => ({ recipes: await fetchRecipes() }),
	component: CookNewPage,
});

function CookNewPage() {
	const { recipes } = Route.useLoaderData();
	const { recipeId } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-bold">記録を追加</h1>
				<p className="text-sm text-muted-foreground">
					作った日時と感想を残します。写真は保存したあとの画面で追加できます。
				</p>
			</div>

			{recipes.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>先にレシピを登録してください</CardTitle>
						<CardDescription>
							記録はレシピに紐付くので、レシピが 1 件もないと追加できません。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link className={buttonVariants()} to="/recipes/new">
							レシピを登録する
						</Link>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent>
						<CookForm
							cook={null}
							defaultRecipeId={recipeId ?? null}
							onSaved={async (cookId) => {
								await navigate({
									params: { cookId },
									to: "/cooks/$cookId",
								});
							}}
							recipes={recipes}
						/>
					</CardContent>
				</Card>
			)}
		</main>
	);
}
