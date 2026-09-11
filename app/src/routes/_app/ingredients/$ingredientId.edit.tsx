import {
	createFileRoute,
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TrashIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	fetchIngredient,
	removeIngredient,
} from "@/server/ingredients.functions";
import { isInventiaLinkAvailable } from "@/server/inventia.functions";
import { IngredientForm } from "./-components/ingredient-form";

export const Route = createFileRoute("/_app/ingredients/$ingredientId/edit")({
	staticData: {
		breadcrumbs: [
			{ label: "材料", to: "/ingredients" },
			{ label: "材料の編集" },
		],
	},
	loader: async ({ params }) => {
		const [result, inventiaAvailable] = await Promise.all([
			fetchIngredient({ data: { ingredientId: params.ingredientId } }),
			isInventiaLinkAvailable(),
		]);
		if (result === null) {
			return null;
		}
		return {
			...result,
			inventiaAvailable,
			breadcrumbs: [
				{ label: "材料", to: "/ingredients" },
				{ label: result.ingredient.name },
			],
		};
	},
	component: EditIngredient,
	errorComponent: EditIngredientError,
});

function EditIngredient() {
	const data = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const remove = useServerFn(removeIngredient);
	const [error, setError] = useState<string | null>(null);
	const [isRemoving, setIsRemoving] = useState(false);

	if (data === null) {
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
				<Card>
					<CardHeader>
						<CardTitle>材料が見つかりません</CardTitle>
						<CardDescription>
							削除されたか、URL が違う可能性があります。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button render={<Link to="/ingredients" />} variant="outline">
							材料の一覧へ戻る
						</Button>
					</CardContent>
				</Card>
			</main>
		);
	}

	const { ingredient, usageCount, inventiaAvailable } = data;

	const removeCurrent = async () => {
		if (
			!window.confirm(
				"この材料を削除しますか？ レシピの材料名はそのまま残ります。",
			)
		) {
			return;
		}
		setError(null);
		setIsRemoving(true);
		try {
			const result = await remove({ data: { ingredientId: ingredient.id } });
			if (!result.ok) {
				setError(result.message);
				return;
			}
			await navigate({ to: "/ingredients" });
		} finally {
			setIsRemoving(false);
		}
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div>
				<h1 className="text-2xl font-bold">材料の編集</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					{usageCount}{" "}
					件のレシピで使われています。削除してもレシピの材料名は残ります。
				</p>
			</div>

			<IngredientForm
				ingredient={ingredient}
				inventiaAvailable={inventiaAvailable}
				onSaved={() => void router.invalidate()}
			/>

			<Card>
				<CardHeader>
					<CardTitle>削除</CardTitle>
					<CardDescription>
						この材料を削除します。レシピに書かれた材料名はそのまま残ります。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{error ? (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}
					<div>
						<Button
							disabled={isRemoving}
							onClick={() => void removeCurrent()}
							type="button"
							variant="destructive"
						>
							<TrashIcon />
							{isRemoving ? "削除しています…" : "削除"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}

function EditIngredientError({ error, reset }: ErrorComponentProps) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Card>
				<CardHeader>
					<CardTitle>材料を読み込めませんでした</CardTitle>
					<CardDescription>{error.message}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Button onClick={reset} variant="outline">
						再読み込み
					</Button>
					<Button render={<Link to="/ingredients" />} variant="ghost">
						材料の一覧へ戻る
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}
