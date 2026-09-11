"use client";

import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { IngredientListItem } from "@/domain/ingredient";
import type { RecipeDetail } from "@/domain/recipe";
import { recipeInputSchema } from "@/domain/recipe";
import {
	formatAmount,
	isQuantifiable,
	type UnitSlug,
	unitLabel,
	unitLabels,
	unitSlugs,
} from "@/domain/units";

import { submitRecipe } from "@/server/recipes.functions";
import type { RecipeCategory } from "@/server/recipes.server";

/** フォームの入力値。数値は文字列のまま持ち、送信時に検証して数値へ直す */
export interface RecipeFormValues {
	readonly title: string;
	readonly categorySlug: string;
	readonly summary: string;
	readonly servingsValue: string;
	readonly servingsUnit: UnitSlug;
	readonly prepMinutes: string;
	readonly cookMinutes: string;
	readonly restMinutes: string;
	readonly ingredients: readonly {
		readonly key: string;
		readonly name: string;
		readonly value: string;
		readonly unit: UnitSlug;
		readonly note: string;
		readonly ingredientId: string | null;
	}[];
	readonly steps: readonly { readonly key: string; readonly text: string }[];
	readonly sourceType: "original" | "book" | "web" | "video" | "other";
	readonly sourceTitle: string;
	readonly sourceUrl: string;
	readonly tags: string;
	readonly note: string;
}

export const emptyRecipeFormValues = (
	categorySlug: string,
): RecipeFormValues => ({
	title: "",
	categorySlug,
	summary: "",
	servingsValue: "",
	servingsUnit: "serving",
	prepMinutes: "",
	cookMinutes: "",
	restMinutes: "",
	ingredients: [
		{
			key: crypto.randomUUID(),
			name: "",
			value: "",
			unit: "g",
			note: "",
			ingredientId: null,
		},
	],
	steps: [{ key: crypto.randomUUID(), text: "" }],
	sourceType: "original",
	sourceTitle: "",
	sourceUrl: "",
	tags: "",
	note: "",
});

export interface RecipeFormProps {
	readonly recipeId: string | null;
	readonly defaultValues: RecipeFormValues;
	readonly categories: readonly RecipeCategory[];
	readonly ingredients: readonly IngredientListItem[];
	readonly onSaved: (recipeId: string) => void;
}

/** 保存済みのレシピを編集フォームの初期値へ写す */
export const recipeFormValuesFromDetail = (
	detail: RecipeDetail,
): RecipeFormValues => ({
	title: detail.title,
	categorySlug: detail.categorySlug,
	summary: detail.summary ?? "",
	servingsValue:
		detail.servings?.value === null || detail.servings === null
			? ""
			: String(detail.servings.value),
	servingsUnit: detail.servings?.unit ?? "serving",
	prepMinutes:
		detail.times.prepMinutes === null ? "" : String(detail.times.prepMinutes),
	cookMinutes:
		detail.times.cookMinutes === null ? "" : String(detail.times.cookMinutes),
	restMinutes:
		detail.times.restMinutes === null ? "" : String(detail.times.restMinutes),
	ingredients: detail.ingredients.map((ingredient) => ({
		key: ingredient.id,
		name: ingredient.name,
		value:
			ingredient.amount.value === null ? "" : String(ingredient.amount.value),
		unit: ingredient.amount.unit,
		note: ingredient.note ?? "",
		ingredientId: ingredient.ingredient?.id ?? null,
	})),
	steps: detail.steps.map((step) => ({ key: step.id, text: step.text })),
	sourceType: detail.source?.type ?? "original",
	sourceTitle: detail.source?.title ?? "",
	sourceUrl: detail.source?.url ?? "",
	tags: detail.tags.join(", "),
	note: detail.note ?? "",
});

const sourceTypeLabels = {
	original: "オリジナル",
	book: "書籍",
	web: "Web",
	video: "動画",
	other: "その他",
} as const;

const asNumber = (value: string): number | null => {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const asNullable = (value: string): string | null =>
	value.trim().length === 0 ? null : value.trim();

export function RecipeForm({
	recipeId,
	defaultValues,
	categories,
	ingredients,
	onSaved,
}: RecipeFormProps) {
	const [values, setValues] = useState<RecipeFormValues>(defaultValues);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const submit = useServerFn(submitRecipe);
	const router = useRouter();
	const categoryItems: Record<string, string> = Object.fromEntries(
		categories.map((category) => [category.slug, category.name]),
	);

	const patch = (changes: Partial<RecipeFormValues>) =>
		setValues((current) => ({ ...current, ...changes }));

	const patchIngredient = (
		index: number,
		changes: Partial<RecipeFormValues["ingredients"][number]>,
	) =>
		setValues((current) => ({
			...current,
			ingredients: current.ingredients.map((ingredient, position) =>
				position === index ? { ...ingredient, ...changes } : ingredient,
			),
		}));

	const save = async () => {
		setError(null);
		const parsed = recipeInputSchema.safeParse({
			title: values.title,
			categorySlug: values.categorySlug,
			summary: asNullable(values.summary),
			servings:
				values.servingsValue.trim().length === 0 &&
				!isQuantifiable(values.servingsUnit)
					? { value: null, unit: values.servingsUnit }
					: {
							value: asNumber(values.servingsValue),
							unit: values.servingsUnit,
						},
			times: {
				prepMinutes: asNumber(values.prepMinutes),
				cookMinutes: asNumber(values.cookMinutes),
				restMinutes: asNumber(values.restMinutes),
			},
			ingredients: values.ingredients
				.filter((ingredient) => ingredient.name.trim().length > 0)
				.map((ingredient) => ({
					name: ingredient.name,
					amount: { value: asNumber(ingredient.value), unit: ingredient.unit },
					note: asNullable(ingredient.note),
					ingredientId: ingredient.ingredientId,
				})),
			steps: values.steps
				.filter((step) => step.text.trim().length > 0)
				.map((step) => ({ text: step.text })),
			source: {
				type: values.sourceType,
				title: asNullable(values.sourceTitle),
				url: asNullable(values.sourceUrl),
			},
			tags: values.tags
				.split(/[,\u3001]/)
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0),
			note: asNullable(values.note),
		});
		if (!parsed.success) {
			setError(
				parsed.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join(" / "),
			);
			return;
		}

		setIsSaving(true);
		try {
			const result = await submit({ data: { recipeId, input: parsed.data } });
			if (!result.ok) {
				setError(result.message);
				return;
			}
			// 一覧や詳細の loader を読み直してから移動する（親 route の古い表示を残さない）
			await router.invalidate();
			onSaved(result.data.recipeId);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>基本</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2 sm:col-span-2">
						<Label htmlFor="recipe-title">タイトル</Label>
						<Input
							id="recipe-title"
							onChange={(event) => patch({ title: event.target.value })}
							placeholder="例: タルト・タタン"
							value={values.title}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="recipe-category">種類</Label>
						<Select
							items={categoryItems}
							onValueChange={(value) => patch({ categorySlug: String(value) })}
							value={values.categorySlug}
						>
							<SelectTrigger className="w-full" id="recipe-category">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.slug}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{categories.length === 0 ? (
							<p className="text-xs text-destructive">
								種類がありません。設定から追加してください。
							</p>
						) : null}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="recipe-servings">できあがり量</Label>
						<div className="flex gap-2">
							<Input
								className="w-24"
								id="recipe-servings"
								inputMode="decimal"
								onChange={(event) =>
									patch({ servingsValue: event.target.value })
								}
								placeholder="18"
								value={values.servingsValue}
							/>
							<Select
								items={unitLabels}
								onValueChange={(value) =>
									patch({ servingsUnit: value as UnitSlug })
								}
								value={values.servingsUnit}
							>
								<SelectTrigger className="flex-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{unitSlugs.map((slug) => (
										<SelectItem key={slug} value={slug}>
											{unitLabel(slug)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="grid gap-2 sm:col-span-2">
						<Label htmlFor="recipe-summary">説明</Label>
						<Textarea
							id="recipe-summary"
							onChange={(event) => patch({ summary: event.target.value })}
							placeholder="どんなお菓子か、どんなときに作るか"
							rows={2}
							value={values.summary}
						/>
					</div>
					<div className="grid gap-2">
						<Label>時間（分）</Label>
						<div className="flex gap-2">
							<Input
								aria-label="準備の時間（分）"
								inputMode="numeric"
								onChange={(event) => patch({ prepMinutes: event.target.value })}
								placeholder="準備"
								value={values.prepMinutes}
							/>
							<Input
								aria-label="加熱の時間（分）"
								inputMode="numeric"
								onChange={(event) => patch({ cookMinutes: event.target.value })}
								placeholder="加熱"
								value={values.cookMinutes}
							/>
							<Input
								aria-label="休ませる時間（分）"
								inputMode="numeric"
								onChange={(event) => patch({ restMinutes: event.target.value })}
								placeholder="休憩"
								value={values.restMinutes}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>材料</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{values.ingredients.map((ingredient, index) => {
						const master = ingredients.find(
							(candidate) => candidate.name === ingredient.name.trim(),
						);
						return (
							<div
								className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]"
								key={ingredient.key}
							>
								<Input
									aria-label="材料名"
									onChange={(event) =>
										patchIngredient(index, {
											name: event.target.value,
											// 名前を変えたら材料マスタとの結び付きは保存時に名前で引き直す
											ingredientId: null,
										})
									}
									placeholder="材料名（例: 薄力粉）"
									value={ingredient.name}
								/>
								<Input
									aria-label="数量"
									disabled={!isQuantifiable(ingredient.unit)}
									inputMode="decimal"
									onChange={(event) =>
										patchIngredient(index, { value: event.target.value })
									}
									placeholder="100"
									value={ingredient.value}
								/>
								<Select
									items={unitLabels}
									onValueChange={(value) =>
										patchIngredient(index, { unit: value as UnitSlug })
									}
									value={ingredient.unit}
								>
									<SelectTrigger aria-label="単位">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{unitSlugs.map((slug) => (
											<SelectItem key={slug} value={slug}>
												{unitLabel(slug)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									aria-label="この材料を削除"
									onClick={() =>
										patch({
											ingredients: values.ingredients.filter(
												(_, position) => position !== index,
											),
										})
									}
									size="icon"
									type="button"
									variant="ghost"
								>
									<TrashIcon />
								</Button>
								<div className="grid gap-2 sm:col-span-4">
									<Input
										aria-label="材料のメモ"
										onChange={(event) =>
											patchIngredient(index, { note: event.target.value })
										}
										placeholder="メモ（例: ふるっておく）"
										value={ingredient.note}
									/>
									{ingredient.name.trim().length > 0 ? (
										<p className="text-xs text-muted-foreground">
											{master
												? `${master.name}（材料マスタ）${
														master.gramsPerMilliliter === null
															? ""
															: ` / 大さじ1 = ${formatAmount(master.gramsPerMilliliter * 15, "g")}`
													}`
												: "同じ名前の材料を材料マスタに登録すると、大さじやグラムの換算が使えます。"}
										</p>
									) : null}
								</div>
							</div>
						);
					})}
					<div>
						<Button
							onClick={() =>
								patch({
									ingredients: [
										...values.ingredients,
										{
											key: crypto.randomUUID(),
											name: "",
											value: "",
											unit: "g",
											note: "",
											ingredientId: null,
										},
									],
								})
							}
							type="button"
							variant="outline"
						>
							<PlusIcon />
							材料を追加
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>手順</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{values.steps.map((step, index) => (
						<div className="flex items-start gap-2" key={step.key}>
							<span className="mt-2 w-6 shrink-0 text-right text-sm text-muted-foreground">
								{index + 1}.
							</span>
							<Textarea
								aria-label={`手順 ${index + 1}`}
								onChange={(event) =>
									patch({
										steps: values.steps.map((current, position) =>
											position === index
												? { ...current, text: event.target.value }
												: current,
										),
									})
								}
								placeholder="例: りんごを皮ごと 8 等分に切る"
								rows={2}
								value={step.text}
							/>
							<Button
								aria-label={`手順 ${index + 1} を削除`}
								onClick={() =>
									patch({
										steps: values.steps.filter(
											(_, position) => position !== index,
										),
									})
								}
								size="icon"
								type="button"
								variant="ghost"
							>
								<TrashIcon />
							</Button>
						</div>
					))}
					<div>
						<Button
							onClick={() =>
								patch({
									steps: [
										...values.steps,
										{ key: crypto.randomUUID(), text: "" },
									],
								})
							}
							type="button"
							variant="outline"
						>
							<PlusIcon />
							手順を追加
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>出典とメモ</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2">
						<Label>出典の種類</Label>
						<Select
							items={sourceTypeLabels}
							onValueChange={(value) =>
								patch({ sourceType: value as RecipeFormValues["sourceType"] })
							}
							value={values.sourceType}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(sourceTypeLabels).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="recipe-source-title">書名・ページ・サイト名</Label>
						<Input
							id="recipe-source-title"
							onChange={(event) => patch({ sourceTitle: event.target.value })}
							value={values.sourceTitle}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="recipe-source-url">出典の URL</Label>
						<Input
							id="recipe-source-url"
							onChange={(event) => patch({ sourceUrl: event.target.value })}
							placeholder="https://…"
							value={values.sourceUrl}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="recipe-tags">タグ</Label>
						<Input
							id="recipe-tags"
							onChange={(event) => patch({ tags: event.target.value })}
							placeholder="秋, 定番（カンマ区切り）"
							value={values.tags}
						/>
					</div>
					<div className="grid gap-2 sm:col-span-2">
						<Label htmlFor="recipe-note">メモ</Label>
						<Textarea
							id="recipe-note"
							onChange={(event) => patch({ note: event.target.value })}
							placeholder="次に作るときの注意点など"
							rows={3}
							value={values.note}
						/>
					</div>
				</CardContent>
			</Card>

			<div className="flex gap-2">
				<Button disabled={isSaving} type="submit">
					{isSaving ? "保存しています…" : "保存"}
				</Button>
			</div>
		</form>
	);
}
