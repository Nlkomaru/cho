import {
	createFileRoute,
	Link,
	Outlet,
	useChildMatches,
	useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	ExternalLinkIcon,
	PencilIcon,
	TrashIcon,
	UtensilsCrossedIcon,
} from "lucide-react";
import { useState } from "react";

import { ImageUploader } from "@/components/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/domain/units";
import { formatJstDate, formatJstDateTime } from "@/lib/datetime";
import { inventiaItemUrl } from "@/lib/inventory";
import { fetchRecipe, removeRecipe } from "@/server/recipes.functions";
import { IngredientAmount } from "./-components/ingredient-amount";

export const Route = createFileRoute("/_app/recipes/$recipeId")({
	loader: async ({ params }) => {
		const recipe = await fetchRecipe({ data: { recipeId: params.recipeId } });
		return {
			recipe,
			breadcrumbs: [
				{ label: "レシピ", to: "/recipes" },
				{ label: recipe?.title ?? "見つかりません" },
			],
		};
	},
	component: RecipeDetailPage,
});

function RecipeDetailPage() {
	// 編集画面（`/recipes/$recipeId/edit`）はこの route の子なので、子が居るときは子に描かせる
	const childCount = useChildMatches({ select: (matches) => matches.length });

	if (childCount > 0) {
		return <Outlet />;
	}

	return <RecipeDetailView />;
}

function RecipeDetailView() {
	const { recipe } = Route.useLoaderData();
	const navigate = useNavigate();
	const remove = useServerFn(removeRecipe);
	const [showGrams, setShowGrams] = useState(false);
	const [images, setImages] = useState(recipe?.images ?? []);
	const [error, setError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

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

	const deleteRecipe = async () => {
		if (
			!window.confirm(
				`「${recipe.title}」と、このレシピの作った記録を削除しますか？`,
			)
		) {
			return;
		}
		setError(null);
		setIsDeleting(true);
		try {
			const result = await remove({ data: { recipeId: recipe.id } });
			if (!result.ok) {
				setError(result.message);
				return;
			}
			await navigate({ to: "/recipes" });
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-bold">{recipe.title}</h1>
						<Badge variant="secondary">{recipe.categoryName}</Badge>
						{recipe.tags.map((tag) => (
							<Badge key={tag} variant="outline">
								{tag}
							</Badge>
						))}
					</div>
					{recipe.summary ? (
						<p className="text-sm text-muted-foreground">{recipe.summary}</p>
					) : null}
					<p className="text-xs text-muted-foreground">
						更新: {formatJstDate(recipe.updatedAt)}
						{recipe.servings
							? ` / できあがり: ${
									recipe.servings.value === null
										? ""
										: formatAmount(recipe.servings.value, recipe.servings.unit)
								}`
							: ""}
						{recipe.times.cookMinutes === null
							? ""
							: ` / 加熱 ${recipe.times.cookMinutes} 分`}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						render={
							<Link
								params={{ recipeId: recipe.id }}
								search={{ recipeId: recipe.id }}
								to="/cooks/new"
							/>
						}
					>
						<UtensilsCrossedIcon />
						作った記録を追加
					</Button>
					<Button
						render={
							<Link
								params={{ recipeId: recipe.id }}
								to="/recipes/$recipeId/edit"
							/>
						}
						variant="outline"
					>
						<PencilIcon />
						編集
					</Button>
					<Button
						disabled={isDeleting}
						onClick={deleteRecipe}
						variant="destructive"
					>
						<TrashIcon />
						削除
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader className="flex-row items-center justify-between">
					<CardTitle>材料</CardTitle>
					<div className="flex items-center gap-2">
						<Switch
							checked={showGrams}
							id="show-grams"
							onCheckedChange={setShowGrams}
						/>
						<Label htmlFor="show-grams">グラムで見る</Label>
					</div>
				</CardHeader>
				<CardContent>
					{recipe.ingredients.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							材料が登録されていません。
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>材料</TableHead>
									<TableHead>分量</TableHead>
									<TableHead className="hidden sm:table-cell">メモ</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{recipe.ingredients.map((ingredient) => (
									<TableRow key={ingredient.id}>
										<TableCell>
											<div className="flex flex-col gap-1">
												<span>{ingredient.name}</span>
												{ingredient.ingredient?.inventoryItemId ? (
													<a
														className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
														href={inventiaItemUrl(
															ingredient.ingredient.inventoryItemId,
														)}
														rel="noreferrer"
														target="_blank"
													>
														Inventia で在庫を見る
														<ExternalLinkIcon className="size-3" />
													</a>
												) : ingredient.ingredient ? (
													<Link
														className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
														params={{ ingredientId: ingredient.ingredient.id }}
														to="/ingredients/$ingredientId/edit"
													>
														材料マスタ: {ingredient.ingredient.name}
													</Link>
												) : (
													<Link
														className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
														to="/ingredients/new"
													>
														材料マスタに登録すると換算できます
													</Link>
												)}
											</div>
										</TableCell>
										<TableCell>
											<IngredientAmount
												amount={ingredient.amount}
												showGrams={showGrams}
												units={ingredient.ingredient}
											/>
										</TableCell>
										<TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
											{ingredient.note ?? ""}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>作り方</CardTitle>
				</CardHeader>
				<CardContent>
					<ol className="flex flex-col gap-3">
						{recipe.steps.map((step, index) => (
							<li className="flex gap-3" key={step.id}>
								<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
									{index + 1}
								</span>
								<p className="whitespace-pre-wrap text-sm">{step.text}</p>
							</li>
						))}
					</ol>
					{recipe.note ? (
						<p className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
							{recipe.note}
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>レシピの写真</CardTitle>
				</CardHeader>
				<CardContent>
					<ImageUploader
						images={images}
						onChange={setImages}
						ownerId={recipe.id}
						scope="recipe"
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex-row items-center justify-between">
					<CardTitle>作った記録</CardTitle>
					<Button
						render={
							<Link
								params={{ recipeId: recipe.id }}
								search={{ recipeId: recipe.id }}
								to="/cooks/new"
							/>
						}
						size="sm"
						variant="outline"
					>
						記録を追加
					</Button>
				</CardHeader>
				<CardContent>
					{recipe.cooks.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							まだ作っていません。
						</p>
					) : (
						<ul className="flex flex-col gap-4">
							{recipe.cooks.map((cook) => (
								<li
									className="flex flex-col gap-2 rounded-lg border p-3"
									key={cook.id}
								>
									<div className="flex flex-wrap items-center gap-2">
										<Link
											className="font-medium hover:underline"
											params={{ cookId: cook.id }}
											to="/cooks/$cookId"
										>
											{formatJstDateTime(cook.cookedAt)}
										</Link>
										{cook.rating === null ? null : (
											<span
												aria-label={`評価 ${cook.rating}`}
												className="text-sm text-amber-500"
												role="img"
											>
												{"★".repeat(cook.rating)}
											</span>
										)}
										{cook.instagramUrl ? (
											<a
												className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
												href={cook.instagramUrl}
												rel="noreferrer"
												target="_blank"
											>
												Instagram
												<ExternalLinkIcon className="size-3" />
											</a>
										) : null}
									</div>
									{cook.note ? (
										<p className="whitespace-pre-wrap text-sm">{cook.note}</p>
									) : null}
									{cook.images.length > 0 ? (
										<ul className="flex flex-wrap gap-2">
											{cook.images.map((image) => (
												<li key={image.id}>
													<img
														alt={image.alt ?? "作った記録の写真"}
														className="size-24 rounded-lg border object-cover"
														src={`/images/${image.key}`}
													/>
												</li>
											))}
										</ul>
									) : null}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			{recipe.source ? (
				<Card>
					<CardHeader>
						<CardTitle>出典</CardTitle>
					</CardHeader>
					<CardContent className="text-sm">
						{recipe.source.title ?? "出典の記録"}
						{recipe.source.url ? (
							<a
								className="ml-2 inline-flex items-center gap-1 underline-offset-4 hover:underline"
								href={recipe.source.url}
								rel="noreferrer"
								target="_blank"
							>
								{recipe.source.url}
								<ExternalLinkIcon className="size-3" />
							</a>
						) : null}
					</CardContent>
				</Card>
			) : null}
		</main>
	);
}
