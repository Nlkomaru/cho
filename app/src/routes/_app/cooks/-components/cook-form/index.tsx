"use client";

import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2Icon, SaveIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { CookDetail } from "@/domain/cook";
import { cookInputSchema } from "@/domain/cook";
import type { RecipeListItem } from "@/domain/recipe";
import {
	fromJstInputValue,
	nowAsJstInputValue,
	toJstInputValue,
} from "@/lib/datetime";
import { submitCook } from "@/server/cooks.functions";

/** 評価の選択肢。未評価は null で送る */
const ratingItems = [
	{ label: "未評価", value: null },
	{ label: "★1", value: 1 },
	{ label: "★2", value: 2 },
	{ label: "★3", value: 3 },
	{ label: "★4", value: 4 },
	{ label: "★5", value: 5 },
] as const;

export interface CookFormProps {
	/** 選べるレシピ。loader で取得して親から渡す */
	readonly recipes: readonly RecipeListItem[];
	/** 編集対象。新規作成のときは null */
	readonly cook: CookDetail | null;
	/** 新規作成時に選んでおくレシピ。`?recipeId=` から渡す */
	readonly defaultRecipeId: string | null;
	/** 保存できたときに保存後の id を受け取る */
	readonly onSaved: (cookId: string) => void;
}

/** 新規作成の初期値。今の日本時間を分単位で切り出した値 */
const initialCookedAt = (): string =>
	nowAsJstInputValue().toISOString().slice(0, 16);

/**
 * 作った記録の作成と編集で使うフォーム。日時は日本時間で入力させ、
 * 送信時に UTC の ISO 8601 へ戻す。
 */
export function CookForm({
	recipes,
	cook,
	defaultRecipeId,
	onSaved,
}: CookFormProps) {
	const router = useRouter();
	const submit = useServerFn(submitCook);
	const preferredRecipeId = cook?.recipeId ?? defaultRecipeId ?? "";
	const [recipeId, setRecipeId] = useState(() =>
		recipes.some((recipe) => recipe.id === preferredRecipeId)
			? preferredRecipeId
			: "",
	);
	const [cookedAt, setCookedAt] = useState(() =>
		cook ? toJstInputValue(cook.cookedAt) : initialCookedAt(),
	);
	const [rating, setRating] = useState<number | null>(cook?.rating ?? null);
	const [note, setNote] = useState(cook?.note ?? "");
	const [instagramUrl, setInstagramUrl] = useState(cook?.instagramUrl ?? "");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const recipeItems = recipes.map((recipe) => ({
		label: recipe.title,
		value: recipe.id,
	}));

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (recipeId === "") {
			setError("レシピを選んでください。");
			return;
		}
		if (cookedAt === "") {
			setError("作った日時を入力してください。");
			return;
		}

		const trimmedNote = note.trim();
		const trimmedUrl = instagramUrl.trim();
		const parsed = cookInputSchema.safeParse({
			recipeId,
			cookedAt: fromJstInputValue(cookedAt),
			rating,
			note: trimmedNote === "" ? null : trimmedNote,
			instagramUrl: trimmedUrl === "" ? null : trimmedUrl,
		});
		if (!parsed.success) {
			setError(parsed.error.issues.map((issue) => issue.message).join(" / "));
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			const result = await submit({
				data: { cookId: cook?.id ?? null, input: parsed.data },
			});
			if (!result.ok) {
				setError(result.message);
				return;
			}
			await router.invalidate();
			onSaved(result.data.cookId);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "記録を保存できませんでした。",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form className="flex flex-col gap-6" onSubmit={handleSubmit}>
			{error ? (
				<Alert variant="destructive">
					<AlertTitle>保存できませんでした</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<div className="grid gap-2">
				<Label htmlFor="cook-recipe">レシピ</Label>
				<Select
					items={recipeItems}
					onValueChange={(value) => setRecipeId(value ?? "")}
					value={recipeId === "" ? null : recipeId}
				>
					<SelectTrigger className="w-full" id="cook-recipe">
						<SelectValue placeholder="レシピを選んでください" />
					</SelectTrigger>
					<SelectContent>
						{recipeItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="grid gap-2">
				<Label htmlFor="cook-cooked-at">作った日時</Label>
				<Input
					id="cook-cooked-at"
					onChange={(event) => setCookedAt(event.target.value)}
					required
					type="datetime-local"
					value={cookedAt}
				/>
				<p className="text-sm text-muted-foreground">
					日本時間で入力してください。
				</p>
			</div>

			<div className="grid gap-2">
				<Label htmlFor="cook-rating">評価</Label>
				<Select
					items={ratingItems}
					onValueChange={(value) => setRating(value)}
					value={rating}
				>
					<SelectTrigger className="w-full" id="cook-rating">
						<SelectValue placeholder="評価を選んでください" />
					</SelectTrigger>
					<SelectContent>
						{ratingItems.map((item) => (
							<SelectItem key={item.label} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="grid gap-2">
				<Label htmlFor="cook-note">感想</Label>
				<Textarea
					id="cook-note"
					maxLength={2000}
					onChange={(event) => setNote(event.target.value)}
					placeholder="食べた感想や、次に作りたいときのメモ"
					rows={6}
					value={note}
				/>
			</div>

			<div className="grid gap-2">
				<Label htmlFor="cook-instagram-url">Instagram の投稿リンク</Label>
				<Input
					id="cook-instagram-url"
					onChange={(event) => setInstagramUrl(event.target.value)}
					placeholder="https://www.instagram.com/p/..."
					type="url"
					value={instagramUrl}
				/>
			</div>

			<div className="flex justify-end">
				<Button disabled={isSubmitting} type="submit">
					{isSubmitting ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<SaveIcon />
					)}
					{isSubmitting ? "保存しています" : "保存する"}
				</Button>
			</div>
		</form>
	);
}
