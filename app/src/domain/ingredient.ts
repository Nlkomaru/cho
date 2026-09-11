import { z } from "zod";

import {
	toBaseAmount,
	type UnitSlug,
	unitInputSchema,
	unitLabel,
} from "./units";

/**
 * 材料ごとの単位換算。
 *
 * 体積（ml・大さじ・小さじ・カップ・合）から g への換算は、材料ごとの密度
 * `gramsPerMilliliter` を基準にする。密度では表せない数え方（1個 = 50g など）や、
 * 密度より実測を優先したい単位は `ingredient_conversions` の行で上書きする。
 */

export interface UnitConversion {
	readonly unit: UnitSlug;
	readonly gramsPerUnit: number;
}

export interface IngredientUnits {
	/** 体積 1ml あたりの質量。体積で計らない材料は null */
	readonly gramsPerMilliliter: number | null;
	readonly conversions: readonly UnitConversion[];
}

export interface Amount {
	/** 「適量」のように数量を持たない場合は null */
	readonly value: number | null;
	readonly unit: UnitSlug;
}

export const conversionBases = ["mass", "conversion", "density"] as const;

export type ConversionBasis = (typeof conversionBases)[number];

export interface GramsResolution {
	readonly grams: number;
	readonly basis: ConversionBasis;
}

/** 単位そのものの換算行（大さじ→g など）を引く */
const conversionRow = (
	units: IngredientUnits,
	unit: UnitSlug,
): UnitConversion | undefined =>
	units.conversions.find((conversion) => conversion.unit === unit);

/** 密度を使う体積→g の換算。体積でない単位と密度未設定の材料は null */
const densityGrams = (
	units: IngredientUnits,
	unit: UnitSlug,
	value: number,
): number | null => {
	if (units.gramsPerMilliliter === null) {
		return null;
	}
	const base = toBaseAmount(1, unit);
	if (!base || base.kind !== "volume") {
		return null;
	}
	return base.amount * units.gramsPerMilliliter * value;
};

/** 記録された数量を g で表す。換算できない材料と「適量」は null */
export function gramsOf(
	amount: Amount,
	units: IngredientUnits,
): GramsResolution | null {
	if (amount.value === null) {
		return null;
	}
	const row = conversionRow(units, amount.unit);
	if (row) {
		return { grams: amount.value * row.gramsPerUnit, basis: "conversion" };
	}
	const base = toBaseAmount(amount.value, amount.unit);
	if (base?.kind === "mass") {
		return { grams: base.amount, basis: "mass" };
	}
	if (base?.kind === "volume") {
		const grams = densityGrams(units, amount.unit, amount.value);
		return grams === null ? null : { grams, basis: "density" };
	}
	return null;
}

/** 指定した単位で表したときの値。換算の根拠が無ければ null */
function valueIn(
	units: IngredientUnits,
	unit: UnitSlug,
	grams: number,
): { value: number; basis: ConversionBasis } | null {
	const row = conversionRow(units, unit);
	if (row) {
		return { value: grams / row.gramsPerUnit, basis: "conversion" };
	}
	if (units.gramsPerMilliliter === null) {
		return null;
	}
	const base = toBaseAmount(1, unit);
	if (base?.kind !== "volume") {
		return null;
	}
	return {
		value: grams / (base.amount * units.gramsPerMilliliter),
		basis: "density",
	};
}

export interface AmountRepresentation {
	readonly unit: UnitSlug;
	readonly value: number | null;
	/** recorded はレシピに書かれた単位そのもの */
	readonly basis: ConversionBasis | "recorded";
}

/** 単位を切り替えて見比べる候補。大さじと小さじ、g、および材料ごとの数え方を並べる */
const switchableUnits: readonly UnitSlug[] = [
	"g",
	"tbsp",
	"tsp",
	"cup",
	"ml",
	"piece",
	"pack",
	"slice",
];

export function amountRepresentations(
	amount: Amount,
	units: IngredientUnits,
): readonly AmountRepresentation[] {
	const representations: AmountRepresentation[] = [
		{ unit: amount.unit, value: amount.value, basis: "recorded" },
	];
	const grams = gramsOf(amount, units);
	if (!grams) {
		return representations;
	}
	// 記録がすでに g のときは同じ値が二度並ぶので足さない
	if (amount.unit !== "g") {
		representations.push({ unit: "g", value: grams.grams, basis: grams.basis });
	}
	for (const unit of switchableUnits) {
		if (
			unit === amount.unit ||
			representations.some((entry) => entry.unit === unit)
		) {
			continue;
		}
		const converted = valueIn(units, unit, grams.grams);
		if (converted) {
			representations.push({
				unit,
				value: converted.value,
				basis: converted.basis,
			});
		}
	}
	return representations;
}

/** 換算の根拠を画面に添えるための説明 */
export function describeRepresentation(
	representation: AmountRepresentation,
	units: IngredientUnits,
): string | null {
	switch (representation.basis) {
		case "recorded":
			return null;
		case "mass":
			return "質量そのもの";
		case "conversion":
			return `1${unitLabel(representation.unit)} = ${conversionRow(units, representation.unit)?.gramsPerUnit}g`;
		case "density":
			return `密度 ${units.gramsPerMilliliter}g/ml`;
	}
}

export const ingredientInputSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		// 水は 1.0 前後。極端な値は入力ミスとして弾く
		gramsPerMilliliter: z.number().positive().max(5).nullable(),
		// Inventia の品目 id
		inventoryItemId: z.string().trim().min(1).max(100).nullable(),
		note: z.string().trim().max(1000).nullable(),
		conversions: z
			.array(
				z.object({
					unit: unitInputSchema,
					gramsPerUnit: z.number().positive().max(100000),
				}),
			)
			.max(30),
	})
	.strict()
	.refine(
		(value) =>
			new Set(value.conversions.map((conversion) => conversion.unit)).size ===
			value.conversions.length,
		{ message: "同じ単位の換算が重複しています", path: ["conversions"] },
	);

export type IngredientInput = z.output<typeof ingredientInputSchema>;

export interface IngredientListItem {
	readonly id: string;
	readonly name: string;
	readonly gramsPerMilliliter: number | null;
	readonly inventoryItemId: string | null;
	readonly note: string | null;
	readonly conversions: readonly UnitConversion[];
	readonly updatedAt: string;
}
