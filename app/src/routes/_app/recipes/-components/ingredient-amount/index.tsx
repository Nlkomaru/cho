"use client";

import {
	type Amount,
	amountRepresentations,
	describeRepresentation,
	type IngredientUnits,
} from "@/domain/ingredient";
import { formatAmount, formatAmountWithoutValue } from "@/domain/units";

export interface IngredientAmountProps {
	readonly amount: Amount;
	readonly units: IngredientUnits | null;
	/** グラム換算を主にして表示するかどうか（大さじとグラムの切り替え） */
	readonly showGrams: boolean;
}

const noUnits: IngredientUnits = { gramsPerMilliliter: null, conversions: [] };

const render = (
	value: number | null,
	unit: Parameters<typeof formatAmount>[1],
): string =>
	value === null ? formatAmountWithoutValue(unit) : formatAmount(value, unit);

/** 材料 1 行の分量。切り替えに合わせて主表示を変え、換算できた別単位を小さく添える */
export function IngredientAmount({
	amount,
	units,
	showGrams,
}: IngredientAmountProps) {
	const effectiveUnits = units ?? noUnits;
	const representations = amountRepresentations(amount, effectiveUnits);
	const primary =
		(showGrams
			? representations.find((entry) => entry.unit === "g")
			: undefined) ?? representations[0];
	const alternatives = representations
		.filter((entry) => entry !== primary)
		.slice(0, 2);

	return (
		<div className="flex flex-col">
			<span
				className="font-medium tabular-nums"
				title={describeRepresentation(primary, effectiveUnits) ?? undefined}
			>
				{render(primary.value, primary.unit)}
			</span>
			{alternatives.length > 0 ? (
				<span className="text-xs text-muted-foreground tabular-nums">
					{alternatives
						.map((entry) => render(entry.value, entry.unit))
						.join(" / ")}
				</span>
			) : null}
		</div>
	);
}
