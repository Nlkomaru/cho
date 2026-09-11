import { createFileRoute, Link } from "@tanstack/react-router";

import { isInventiaLinkAvailable } from "@/server/inventia.functions";
import { IngredientForm } from "./-components/ingredient-form";

export const Route = createFileRoute("/_app/ingredients/new")({
	staticData: {
		breadcrumbs: [
			{ label: "材料", to: "/ingredients" },
			{ label: "新しい材料" },
		],
	},
	loader: async () => ({ inventiaAvailable: await isInventiaLinkAvailable() }),
	component: NewIngredient,
});

function NewIngredient() {
	const navigate = Route.useNavigate();
	const { inventiaAvailable } = Route.useLoaderData();

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div>
				<h1 className="text-2xl font-bold">新しい材料</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					密度や数え方を登録しておくと、レシピの材料から重さを計算できます。
				</p>
			</div>

			<IngredientForm
				ingredient={null}
				inventiaAvailable={inventiaAvailable}
				onSaved={(ingredientId) =>
					void navigate({
						params: { ingredientId },
						to: "/ingredients/$ingredientId/edit",
					})
				}
			/>

			<div>
				<Link
					className="text-sm text-primary underline-offset-4 hover:underline"
					to="/ingredients"
				>
					材料の一覧へ戻る
				</Link>
			</div>
		</main>
	);
}
