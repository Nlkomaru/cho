import { z } from "zod";

/**
 * レシピで使う単位の定義。
 *
 * DB とレシピ JSON には canonical な slug を保存し、表示と入力では日本語の表記を使う。
 * 入力は表記ゆれ（`大匙`、`cc`、`ｇ` など）を受け付け、境界で slug へ正規化する。
 */
export const unitKinds = ["mass", "volume", "count", "imprecise"] as const;

export type UnitKind = (typeof unitKinds)[number];

export type UnitSlug =
	| "g"
	| "kg"
	| "ml"
	| "l"
	| "tbsp"
	| "tsp"
	| "cup"
	| "gou"
	| "piece"
	| "slice"
	| "stalk"
	| "bunch"
	| "pack"
	| "bag"
	| "can"
	| "bottle"
	| "clove"
	| "slab"
	| "head"
	| "cut"
	| "tray"
	| "serving"
	| "pinch"
	| "dash"
	| "toTaste"
	| "asNeeded";

export interface UnitDefinition {
	/** 画面に出す表記 */
	readonly label: string;
	readonly kind: UnitKind;
	/** mass は g、volume は ml へ換算する係数。数値で表せない単位は null */
	readonly baseFactor: number | null;
	/** 入力を受け付ける別表記。正規化したうえで比較する */
	readonly aliases: readonly string[];
}

export const unitDefinitions: Record<UnitSlug, UnitDefinition> = {
	g: { label: "g", kind: "mass", baseFactor: 1, aliases: ["グラム", "㌘"] },
	kg: {
		label: "kg",
		kind: "mass",
		baseFactor: 1000,
		aliases: ["キロ", "キログラム", "㌔"],
	},
	ml: {
		label: "ml",
		kind: "volume",
		baseFactor: 1,
		aliases: ["ミリリットル", "cc", "㍉"],
	},
	l: {
		label: "L",
		kind: "volume",
		baseFactor: 1000,
		aliases: ["リットル", "ℓ"],
	},
	// 日本の計量スプーン。大さじ 15ml、小さじ 5ml
	tbsp: {
		label: "大さじ",
		kind: "volume",
		baseFactor: 15,
		aliases: ["大匙", "おおさじ"],
	},
	tsp: {
		label: "小さじ",
		kind: "volume",
		baseFactor: 5,
		aliases: ["小匙", "こさじ"],
	},
	cup: {
		label: "カップ",
		kind: "volume",
		baseFactor: 200,
		aliases: ["計量カップ"],
	},
	// 1 合 = 180ml。米や酒の計量に使う
	gou: { label: "合", kind: "volume", baseFactor: 180, aliases: ["ごう"] },
	piece: {
		label: "個",
		kind: "count",
		baseFactor: null,
		aliases: ["こ", "ケ"],
	},
	slice: { label: "枚", kind: "count", baseFactor: null, aliases: ["まい"] },
	stalk: { label: "本", kind: "count", baseFactor: null, aliases: ["ほん"] },
	bunch: { label: "束", kind: "count", baseFactor: null, aliases: ["たば"] },
	pack: { label: "パック", kind: "count", baseFactor: null, aliases: [] },
	bag: { label: "袋", kind: "count", baseFactor: null, aliases: ["ふくろ"] },
	can: { label: "缶", kind: "count", baseFactor: null, aliases: ["かん"] },
	bottle: { label: "瓶", kind: "count", baseFactor: null, aliases: ["びん"] },
	clove: { label: "片", kind: "count", baseFactor: null, aliases: ["ひら"] },
	slab: { label: "丁", kind: "count", baseFactor: null, aliases: ["ちょう"] },
	head: { label: "玉", kind: "count", baseFactor: null, aliases: ["たま"] },
	cut: { label: "切れ", kind: "count", baseFactor: null, aliases: ["きれ"] },
	// できあがり量を表す単位
	tray: { label: "台", kind: "count", baseFactor: null, aliases: ["だい"] },
	serving: {
		label: "人前",
		kind: "count",
		baseFactor: null,
		aliases: ["人分", "にんまえ"],
	},
	pinch: {
		label: "ひとつまみ",
		kind: "imprecise",
		baseFactor: null,
		aliases: [],
	},
	dash: {
		label: "少々",
		kind: "imprecise",
		baseFactor: null,
		aliases: ["しょうしょう"],
	},
	toTaste: {
		label: "適量",
		kind: "imprecise",
		baseFactor: null,
		aliases: ["てきりょう"],
	},
	asNeeded: {
		label: "お好みで",
		kind: "imprecise",
		baseFactor: null,
		aliases: [],
	},
};

export const unitSlugs = Object.keys(unitDefinitions) as readonly UnitSlug[];

/** 選択肢へ渡す slug → 表示名の対応（Base UI Select の items） */
export const unitLabels: Record<string, string> = Object.fromEntries(
	unitSlugs.map((slug) => [slug, unitDefinitions[slug].label]),
);

const normalizeInput = (input: string): string =>
	input.normalize("NFKC").trim().toLowerCase();

/** 入力表記から slug への索引。slug・ラベル・別表記を同じ正規化で引けるようにする */
const slugByInput: Record<string, UnitSlug> = {};
for (const slug of unitSlugs) {
	const definition = unitDefinitions[slug];
	for (const input of [slug, definition.label, ...definition.aliases]) {
		slugByInput[normalizeInput(input)] = slug;
	}
}

export function unitDefinition(slug: UnitSlug): UnitDefinition {
	const definition = unitDefinitions[slug];
	if (!definition) {
		throw new Error(`未知の単位です: ${slug}`);
	}
	return definition;
}

export function unitLabel(slug: UnitSlug): string {
	return unitDefinition(slug).label;
}

/** 入力表記を slug へ正規化する。未知の表記は null（境界で利用者へ差し戻す） */
export function normalizeUnit(input: string): UnitSlug | null {
	return slugByInput[normalizeInput(input)] ?? null;
}

/** 数量を持つ単位かどうか。「適量」「少々」は数値を受け付けない */
export function isQuantifiable(slug: UnitSlug): boolean {
	return unitDefinition(slug).kind !== "imprecise";
}

/** mass は g、volume は ml へ換算する。count と imprecise は数値換算できない */
export function toBaseAmount(
	value: number,
	slug: UnitSlug,
): { kind: "mass" | "volume"; amount: number } | null {
	const definition = unitDefinition(slug);
	if (
		definition.baseFactor === null ||
		definition.kind === "count" ||
		definition.kind === "imprecise"
	) {
		return null;
	}
	return { kind: definition.kind, amount: value * definition.baseFactor };
}

const fractions: readonly (readonly [number, string])[] = [
	[1 / 8, "1/8"],
	[1 / 4, "1/4"],
	[1 / 3, "1/3"],
	[1 / 2, "1/2"],
	[2 / 3, "2/3"],
	[3 / 4, "3/4"],
];

/** 「大さじ2」「小さじ2分の1」のように単位を先に書く単位。他は「900g」「3個」と数の後ろに付ける */
const unitFirstSlugs: readonly UnitSlug[] = ["tbsp", "tsp", "cup", "gou"];

/** 0.5 を「1/2」、1.5 を「1と1/2」の形で読めるようにする */
export function formatAmountValue(value: number): string {
	if (!Number.isFinite(value)) {
		return String(value);
	}
	const rounded = Math.round(value * 1000) / 1000;
	if (Number.isInteger(rounded)) {
		return String(rounded);
	}
	const whole = Math.trunc(rounded);
	const fraction = rounded - whole;
	for (const [ratio, label] of fractions) {
		if (Math.abs(fraction - ratio) < 0.005) {
			return whole === 0 ? label : `${whole}と${label}`;
		}
	}
	return String(Math.round(rounded * 100) / 100);
}

/** 「大さじ1」「900g」「3個」のように、数量と単位を並べて書く */
export function formatAmount(value: number, slug: UnitSlug): string {
	const definition = unitDefinition(slug);
	const formatted = formatAmountValue(value);
	return unitFirstSlugs.includes(slug)
		? `${definition.label}${formatted}`
		: `${formatted}${definition.label}`;
}

/** 数量を持たない「適量」「少々」の表記 */
export function formatAmountWithoutValue(slug: UnitSlug): string {
	return unitLabel(slug);
}

/** 境界で単位表記を slug へ正規化する。未知の表記は利用者へ差し戻す */
export const unitInputSchema = z
	.string()
	.trim()
	.min(1)
	.max(20)
	.transform((value, ctx) => {
		const slug = normalizeUnit(value);
		if (!slug) {
			ctx.addIssue({
				code: "custom",
				message: `未知の単位です: ${value}（例: g、大さじ、小さじ、個）`,
			});
			return z.NEVER;
		}
		return slug;
	});

export const amountInputSchema = z
	.object({
		// 「適量」のように数量を持たない場合は null
		value: z.number().min(0).max(1000000).nullable(),
		unit: unitInputSchema,
	})
	.refine((amount) => amount.value === null || isQuantifiable(amount.unit), {
		message: "「適量」などの数量を持たない単位には数値を指定できません",
		path: ["value"],
	});
