import {
	createFileRoute,
	type ErrorComponentProps,
	Link,
} from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { IngredientListItem } from "@/domain/ingredient";
import { gramsOf } from "@/domain/ingredient";
import type { UnitSlug } from "@/domain/units";
import { formatAmount } from "@/domain/units";
import { formatJstDate } from "@/lib/datetime";
import { inventiaItemUrl } from "@/lib/inventory";
import { fetchIngredients } from "@/server/ingredients.functions";

export const Route = createFileRoute("/_app/ingredients/")({
	staticData: {
		breadcrumbs: [{ label: "材料" }],
	},
	loader: async () => ({ ingredients: await fetchIngredients() }),
	component: IngredientList,
	errorComponent: IngredientListError,
	pendingComponent: IngredientListPending,
});

/** 1 単位分の g。換算表や密度から求め、決められない場合は「—」 */
const gramsFor = (ingredient: IngredientListItem, unit: UnitSlug): string => {
	const resolved = gramsOf({ value: 1, unit }, ingredient);
	return resolved === null ? "—" : formatAmount(resolved.grams, "g");
};

/** 「1個 = 50g / 大さじ1 = 21g」のように換算表を並べる */
const describeConversions = (ingredient: IngredientListItem): string =>
	ingredient.conversions.length === 0
		? "—"
		: ingredient.conversions
				.map(
					(conversion) =>
						`${formatAmount(1, conversion.unit)} = ${formatAmount(conversion.gramsPerUnit, "g")}`,
				)
				.join(" / ");

function IngredientList() {
	const { ingredients } = Route.useLoaderData();

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">材料</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						レシピの材料名と一致する材料は、保存時に自動で結び付きます。
					</p>
				</div>
				<Button render={<Link to="/ingredients/new" />}>
					<PlusIcon />
					材料を追加
				</Button>
			</div>

			{ingredients.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>材料がまだありません</CardTitle>
						<CardDescription>
							レシピの材料名と一致する材料は、保存時に自動で結び付きます。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button render={<Link to="/ingredients/new" />} variant="outline">
							材料を追加
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>材料</TableHead>
									<TableHead>大さじ1</TableHead>
									<TableHead>小さじ1</TableHead>
									<TableHead>数え方</TableHead>
									<TableHead>リンク</TableHead>
									<TableHead>更新</TableHead>
									<TableHead>操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{ingredients.map((ingredient) => (
									<TableRow key={ingredient.id}>
										<TableCell className="font-medium">
											{ingredient.name}
										</TableCell>
										<TableCell>{gramsFor(ingredient, "tbsp")}</TableCell>
										<TableCell>{gramsFor(ingredient, "tsp")}</TableCell>
										<TableCell className="whitespace-normal">
											{describeConversions(ingredient)}
										</TableCell>
										<TableCell>
											{ingredient.inventoryItemId === null ? (
												"—"
											) : (
												<a
													className="text-primary underline-offset-4 hover:underline"
													href={inventiaItemUrl(ingredient.inventoryItemId)}
													rel="noreferrer"
													target="_blank"
												>
													Inventia
												</a>
											)}
										</TableCell>
										<TableCell>{formatJstDate(ingredient.updatedAt)}</TableCell>
										<TableCell>
											<Link
												className="text-primary underline-offset-4 hover:underline"
												params={{ ingredientId: ingredient.id }}
												to="/ingredients/$ingredientId/edit"
											>
												編集
											</Link>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</main>
	);
}

function IngredientListError({ error, reset }: ErrorComponentProps) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Card>
				<CardHeader>
					<CardTitle>材料を読み込めませんでした</CardTitle>
					<CardDescription>{error.message}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={reset} variant="outline">
						再読み込み
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}

function IngredientListPending() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<p className="text-sm text-muted-foreground">読み込んでいます…</p>
		</main>
	);
}
