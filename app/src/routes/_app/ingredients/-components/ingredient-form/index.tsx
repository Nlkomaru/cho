"use client";

import { useServerFn } from "@tanstack/react-start";
import { PlusIcon, TrashIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { IngredientListItem } from "@/domain/ingredient";
import { ingredientInputSchema } from "@/domain/ingredient";
import type { UnitSlug } from "@/domain/units";
import {
	formatAmountValue,
	normalizeUnit,
	unitDefinition,
	unitLabel,
	unitSlugs,
} from "@/domain/units";

import { submitIngredient } from "@/server/ingredients.functions";

interface ConversionRow {
	readonly key: string;
	/** 未選択は空文字 */
	readonly unit: UnitSlug | "";
	readonly gramsPerUnit: string;
}

interface IngredientFormValues {
	readonly name: string;
	readonly gramsPerMilliliter: string;
	readonly inventoryItemId: string;
	readonly note: string;
	readonly conversions: readonly ConversionRow[];
}

export interface IngredientFormProps {
	/** 編集時は既存の材料、新規は null */
	readonly ingredient: IngredientListItem | null;
	readonly onSaved: (ingredientId: string) => void;
}

/** 換算表で選べる単位。密度では表せない数え方と、体積の実測上書きを並べる */
const countUnitSlugs = unitSlugs.filter(
	(slug) => unitDefinition(slug).kind === "count",
);
const volumeUnitSlugs = unitSlugs.filter(
	(slug) => unitDefinition(slug).kind === "volume",
);

const previewUnits: readonly {
	readonly slug: UnitSlug;
	readonly label: string;
}[] = [
	{ slug: "tbsp", label: "大さじ1" },
	{ slug: "tsp", label: "小さじ1" },
	{ slug: "cup", label: "カップ1" },
];

/** 密度から大さじ・小さじ・カップ 1 杯分の g を並べる */
const densityPreview = (gramsPerMilliliter: number): string | null => {
	const parts: string[] = [];
	for (const entry of previewUnits) {
		const baseFactor = unitDefinition(entry.slug).baseFactor;
		if (baseFactor === null) {
			continue;
		}
		parts.push(
			`${entry.label} = ${formatAmountValue(baseFactor * gramsPerMilliliter)}g`,
		);
	}
	return parts.length > 0 ? parts.join(" / ") : null;
};

const formValuesFromItem = (
	ingredient: IngredientListItem | null,
): IngredientFormValues =>
	ingredient === null
		? {
				name: "",
				gramsPerMilliliter: "",
				inventoryItemId: "",
				note: "",
				conversions: [],
			}
		: {
				name: ingredient.name,
				gramsPerMilliliter:
					ingredient.gramsPerMilliliter === null
						? ""
						: String(ingredient.gramsPerMilliliter),
				inventoryItemId: ingredient.inventoryItemId ?? "",
				note: ingredient.note ?? "",
				conversions: ingredient.conversions.map((conversion) => ({
					key: crypto.randomUUID(),
					unit: conversion.unit,
					gramsPerUnit: String(conversion.gramsPerUnit),
				})),
			};

const asNullable = (value: string): string | null =>
	value.trim().length === 0 ? null : value.trim();

export function IngredientForm({ ingredient, onSaved }: IngredientFormProps) {
	const [values, setValues] = useState<IngredientFormValues>(() =>
		formValuesFromItem(ingredient),
	);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const submit = useServerFn(submitIngredient);

	const patch = (changes: Partial<IngredientFormValues>) =>
		setValues((current) => ({ ...current, ...changes }));

	const patchConversion = (key: string, changes: Partial<ConversionRow>) =>
		setValues((current) => ({
			...current,
			conversions: current.conversions.map((row) =>
				row.key === key ? { ...row, ...changes } : row,
			),
		}));

	const addConversion = () =>
		setValues((current) => ({
			...current,
			conversions: [
				...current.conversions,
				{ key: crypto.randomUUID(), unit: "", gramsPerUnit: "" },
			],
		}));

	const removeConversion = (key: string) =>
		setValues((current) => ({
			...current,
			conversions: current.conversions.filter((row) => row.key !== key),
		}));

	const densityValue = Number(values.gramsPerMilliliter.trim());
	const showsDensityPreview =
		values.gramsPerMilliliter.trim().length > 0 &&
		Number.isFinite(densityValue) &&
		densityValue > 0;
	const preview = showsDensityPreview ? densityPreview(densityValue) : null;

	const save = async () => {
		setError(null);

		if (values.name.trim().length === 0) {
			setError("名前を入力してください。");
			return;
		}

		let gramsPerMilliliter: number | null = null;
		if (values.gramsPerMilliliter.trim().length > 0) {
			if (
				!Number.isFinite(densityValue) ||
				densityValue <= 0 ||
				densityValue > 5
			) {
				setError("密度は 0 より大きく 5 以下の数値で入力してください。");
				return;
			}
			gramsPerMilliliter = densityValue;
		}

		const conversions: { unit: UnitSlug; gramsPerUnit: number }[] = [];
		const usedUnits = new Set<UnitSlug>();
		for (const row of values.conversions) {
			const unit = row.unit === "" ? null : normalizeUnit(row.unit);
			if (unit === null) {
				setError("換算表の単位を選択してください。");
				return;
			}
			if (usedUnits.has(unit)) {
				setError(`換算表の「${unitLabel(unit)}」が重複しています。`);
				return;
			}
			const gramsPerUnit = Number(row.gramsPerUnit.trim());
			if (
				row.gramsPerUnit.trim().length === 0 ||
				!Number.isFinite(gramsPerUnit) ||
				gramsPerUnit <= 0
			) {
				setError(
					`換算表の「${unitLabel(unit)}」の g を 0 より大きい数値で入力してください。`,
				);
				return;
			}
			usedUnits.add(unit);
			conversions.push({ unit, gramsPerUnit });
		}

		const parsed = ingredientInputSchema.safeParse({
			name: values.name,
			gramsPerMilliliter,
			inventoryItemId: asNullable(values.inventoryItemId),
			note: asNullable(values.note),
			conversions,
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
			const result = await submit({
				data: { ingredientId: ingredient?.id ?? null, input: parsed.data },
			});
			if (!result.ok) {
				setError(result.message);
				return;
			}
			onSaved(result.data.ingredientId);
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
				<CardContent className="flex flex-col gap-4">
					<div className="grid gap-2">
						<Label htmlFor="ingredient-name">名前</Label>
						<Input
							id="ingredient-name"
							maxLength={100}
							onChange={(event) => patch({ name: event.target.value })}
							placeholder="例: 薄力粉"
							value={values.name}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="ingredient-density">密度（g/ml）</Label>
						<Input
							className="w-32"
							id="ingredient-density"
							inputMode="decimal"
							max="5"
							min="0"
							onChange={(event) =>
								patch({ gramsPerMilliliter: event.target.value })
							}
							placeholder="例: 0.6"
							step="0.01"
							type="number"
							value={values.gramsPerMilliliter}
						/>
						<p className="text-sm text-muted-foreground">
							体積から重さを計算するための値です。大さじ1 = 密度 × 15g、小さじ1
							= 密度 × 5g、カップ1 = 密度 × 200g で計算します。
						</p>
						{preview ? (
							<p className="text-sm text-muted-foreground">{preview}</p>
						) : null}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="ingredient-inventory">Inventia の品目 id</Label>
						<Input
							id="ingredient-inventory"
							maxLength={100}
							onChange={(event) =>
								patch({ inventoryItemId: event.target.value })
							}
							placeholder="例: 3f9c1a2b-…"
							value={values.inventoryItemId}
						/>
						<p className="text-sm text-muted-foreground">
							Inventia の品目ページの URL の id
							部分です。材料の行から在庫の品目へ飛べるようになります。
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>メモ</CardTitle>
				</CardHeader>
				<CardContent>
					<Textarea
						id="ingredient-note"
						maxLength={1000}
						onChange={(event) => patch({ note: event.target.value })}
						placeholder="買い置きの場所、代用品など"
						rows={3}
						value={values.note}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>換算表</CardTitle>
					<CardDescription>
						「1個 = 50g」「1パック =
						200g」のように、密度では表せない数え方を入れます。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{values.conversions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							換算はまだありません。数え方で重さが決まる材料だけ追加します。
						</p>
					) : null}
					{values.conversions.map((row) => (
						<div className="flex flex-wrap items-end gap-2" key={row.key}>
							<div className="grid gap-2">
								<Label htmlFor={`conversion-unit-${row.key}`}>単位</Label>
								<Select
									onValueChange={(value) => {
										if (typeof value === "string") {
											patchConversion(row.key, { unit: value as UnitSlug });
										}
									}}
									value={row.unit === "" ? null : row.unit}
								>
									<SelectTrigger
										className="w-40"
										id={`conversion-unit-${row.key}`}
									>
										<SelectValue placeholder="単位を選択" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectLabel>数え方</SelectLabel>
											{countUnitSlugs.map((slug) => (
												<SelectItem key={slug} value={slug}>
													{unitLabel(slug)}
												</SelectItem>
											))}
										</SelectGroup>
										<SelectGroup>
											<SelectLabel>体積</SelectLabel>
											{volumeUnitSlugs.map((slug) => (
												<SelectItem key={slug} value={slug}>
													{unitLabel(slug)}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor={`conversion-grams-${row.key}`}>
									1単位あたりの g
								</Label>
								<Input
									className="w-32"
									id={`conversion-grams-${row.key}`}
									inputMode="decimal"
									min="0"
									onChange={(event) =>
										patchConversion(row.key, {
											gramsPerUnit: event.target.value,
										})
									}
									placeholder="例: 50"
									step="0.1"
									type="number"
									value={row.gramsPerUnit}
								/>
							</div>
							<Button
								aria-label="この換算を削除"
								onClick={() => removeConversion(row.key)}
								size="icon"
								type="button"
								variant="ghost"
							>
								<TrashIcon />
							</Button>
						</div>
					))}
					<div>
						<Button onClick={addConversion} type="button" variant="outline">
							<PlusIcon />
							換算を追加
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="flex flex-wrap gap-2">
				<Button disabled={isSaving} type="submit">
					{isSaving ? "保存しています…" : "保存"}
				</Button>
			</div>
		</form>
	);
}
