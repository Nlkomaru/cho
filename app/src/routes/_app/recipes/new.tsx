import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardPasteIcon } from "lucide-react";
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

import { fetchIngredients } from "@/server/ingredients.functions";
import {
	fetchCategories,
	importRecipeDocument,
} from "@/server/recipes.functions";
import { emptyRecipeFormValues, RecipeForm } from "./-components/recipe-form";

export const Route = createFileRoute("/_app/recipes/new")({
	staticData: {
		breadcrumbs: [
			{ label: "レシピ", to: "/recipes" },
			{ label: "新しいレシピ" },
		],
	},
	loader: async () => {
		const [categories, ingredients] = await Promise.all([
			fetchCategories(),
			fetchIngredients(),
		]);
		return { categories, ingredients };
	},
	component: NewRecipe,
});

const exampleDocument = {
	schemaVersion: 1,
	title: "りんごのコンポート",
	categorySlug: "sweets",
	summary: "さっぱりした甘さの作り置き。",
	servings: { value: 4, unit: "serving" },
	times: { prepMinutes: 10, cookMinutes: 20, restMinutes: 60 },
	ingredients: [
		{
			name: "りんご",
			amount: { value: 2, unit: "個" },
			note: "紅玉が向きます",
			ingredientId: null,
		},
		{
			name: "グラニュー糖",
			amount: { value: 3, unit: "大さじ" },
			note: null,
			ingredientId: null,
		},
		{
			name: "白ワイン",
			amount: { value: 100, unit: "ml" },
			note: null,
			ingredientId: null,
		},
	],
	steps: [
		{ text: "りんごを 8 等分に切る。" },
		{ text: "材料をすべて鍋に入れて弱火で 15 分煮る。" },
	],
	source: { type: "original", title: null, url: null },
	tags: ["作り置き"],
	note: null,
};

function NewRecipe() {
	const { categories, ingredients } = Route.useLoaderData();
	const navigate = useNavigate();
	const importDocument = useServerFn(importRecipeDocument);
	const [json, setJson] = useState("");
	const [importError, setImportError] = useState<string | null>(null);
	const [isImporting, setIsImporting] = useState(false);

	const runImport = async () => {
		setImportError(null);
		setIsImporting(true);
		try {
			const result = await importDocument({ data: { json } });
			if (!result.ok) {
				setImportError(result.message);
				return;
			}
			await navigate({
				params: { recipeId: result.data.recipeId },
				to: "/recipes/$recipeId",
			});
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div>
				<h1 className="text-2xl font-bold">新しいレシピ</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					フォームで入力するか、レシピ JSON を貼り付けて取り込みます。
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>レシピ JSON から取り込む</CardTitle>
					<CardDescription>
						形式は <code>/schemas/recipe-v1.json</code>（JSON
						Schema）で確認できます。単位は「大さじ」でも
						<code>tbsp</code>{" "}
						でも受け付けます。材料名が材料マスタと一致すると、自動で結び付きます。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="grid gap-2">
						<Label htmlFor="recipe-json">レシピ JSON</Label>
						<Textarea
							className="font-mono text-xs"
							id="recipe-json"
							onChange={(event) => setJson(event.target.value)}
							placeholder='{ "schemaVersion": 1, "title": "…" }'
							rows={8}
							value={json}
						/>
					</div>
					{importError ? (
						<Alert variant="destructive">
							<AlertDescription>{importError}</AlertDescription>
						</Alert>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={isImporting || json.trim().length === 0}
							onClick={runImport}
							type="button"
						>
							<ClipboardPasteIcon />
							{isImporting ? "取り込んでいます…" : "取り込む"}
						</Button>
						<Button
							onClick={() => setJson(JSON.stringify(exampleDocument, null, 2))}
							type="button"
							variant="outline"
						>
							雛形を入れる
						</Button>
					</div>
				</CardContent>
			</Card>

			<RecipeForm
				categories={categories}
				defaultValues={emptyRecipeFormValues(categories[0]?.slug ?? "other")}
				ingredients={ingredients}
				onSaved={(recipeId) =>
					void navigate({ params: { recipeId }, to: "/recipes/$recipeId" })
				}
				recipeId={null}
			/>
		</main>
	);
}
