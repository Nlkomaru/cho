import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardCopyIcon, DownloadIcon } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recipeDocumentFromDetail } from "@/domain/recipe";
import { fetchIngredients } from "@/server/ingredients.functions";
import { fetchCategories, fetchRecipe } from "@/server/recipes.functions";
import {
	RecipeForm,
	recipeFormValuesFromDetail,
} from "./-components/recipe-form";

export const Route = createFileRoute("/_app/recipes/$recipeId/edit")({
	loader: async ({ params }) => {
		const [recipe, categories, ingredients] = await Promise.all([
			fetchRecipe({ data: { recipeId: params.recipeId } }),
			fetchCategories(),
			fetchIngredients(),
		]);
		return {
			recipe,
			categories,
			ingredients,
			breadcrumbs: [
				{ label: "レシピ", to: "/recipes" },
				{
					label: recipe?.title ?? "見つかりません",
					to: `/recipes/${params.recipeId}`,
				},
				{ label: "編集" },
			],
		};
	},
	component: EditRecipe,
});

const fileNameFromTitle = (title: string): string =>
	`${title.replaceAll(/[/\\?%*:|"<>]/g, "_").trim() || "recipe"}.json`;

function EditRecipe() {
	const { recipe, categories, ingredients } = Route.useLoaderData();
	const navigate = useNavigate();
	const [copied, setCopied] = useState(false);

	if (!recipe) {
		return (
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
				<Card>
					<CardHeader>
						<CardTitle>レシピが見つかりません</CardTitle>
					</CardHeader>
					<CardContent>
						<Button render={<Link to="/recipes" />} variant="outline">
							レシピ一覧へ
						</Button>
					</CardContent>
				</Card>
			</main>
		);
	}

	const documentJson = JSON.stringify(
		recipeDocumentFromDetail(recipe),
		null,
		2,
	);

	const download = () => {
		const url = URL.createObjectURL(
			new Blob([documentJson], { type: "application/json" }),
		);
		const anchor = document.createElement("a");
		anchor.download = fileNameFromTitle(recipe.title);
		anchor.href = url;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const copy = async () => {
		await navigator.clipboard.writeText(documentJson);
		setCopied(true);
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div>
				<h1 className="text-2xl font-bold">レシピを編集</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					材料と手順は保存のたびに丸ごと入れ替わります。
				</p>
			</div>

			<RecipeForm
				categories={categories}
				defaultValues={recipeFormValuesFromDetail(recipe)}
				ingredients={ingredients}
				onSaved={(recipeId) =>
					void navigate({ params: { recipeId }, to: "/recipes/$recipeId" })
				}
				recipeId={recipe.id}
			/>

			<Card>
				<CardHeader>
					<CardTitle>レシピ JSON</CardTitle>
					<CardDescription>
						このレシピをそのまま JSON
						として書き出します。取り込みは「新しいレシピ」から行えます。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="grid gap-2">
						<Label htmlFor="recipe-document">書き出した JSON</Label>
						<Textarea
							className="font-mono text-xs"
							id="recipe-document"
							readOnly
							rows={10}
							value={documentJson}
						/>
					</div>
					{copied ? (
						<Alert>
							<AlertDescription>
								クリップボードにコピーしました。
							</AlertDescription>
						</Alert>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button onClick={copy} type="button" variant="outline">
							<ClipboardCopyIcon />
							コピー
						</Button>
						<Button onClick={download} type="button" variant="outline">
							<DownloadIcon />
							ダウンロード
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
