import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { fetchCook } from "@/server/cooks.functions";
import { fetchRecipes } from "@/server/recipes.functions";
import { CookForm } from "./-components/cook-form";

export const Route = createFileRoute("/_app/cooks/$cookId/edit")({
	// 親の `/cooks/$cookId` が動的なパンくずを返すので、ここは末尾の 1 段だけ名乗る
	staticData: {
		breadcrumbs: [{ label: "編集" }],
	},
	loader: async ({ params }) => {
		const cook = await fetchCook({ data: { cookId: params.cookId } });
		const recipes = await fetchRecipes();
		return { cook, recipes };
	},
	component: CookEditPage,
});

function CookEditPage() {
	const { cook, recipes } = Route.useLoaderData();
	const navigate = useNavigate();

	if (cook === null) {
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
				<Card>
					<CardHeader>
						<CardTitle>記録が見つかりません</CardTitle>
						<CardDescription>
							削除されたか、URL が正しくない可能性があります。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link className={buttonVariants()} to="/">
							作った記録の一覧へ
						</Link>
					</CardContent>
				</Card>
			</main>
		);
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-bold">記録を編集</h1>
				<p className="text-sm text-muted-foreground">
					作った日時と感想を書き換えられます。
				</p>
			</div>

			{recipes.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>先にレシピを登録してください</CardTitle>
						<CardDescription>
							記録はレシピに紐付くので、レシピが 1 件もないと編集できません。
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
							cook={cook}
							defaultRecipeId={null}
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
