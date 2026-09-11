import {
	createFileRoute,
	type ErrorComponentProps,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TrashIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	fetchCategories,
	removeCategory,
	submitCategory,
} from "@/server/recipes.functions";

export const Route = createFileRoute("/_app/settings")({
	staticData: {
		breadcrumbs: [{ label: "設定" }],
	},
	loader: async () => ({ categories: await fetchCategories() }),
	component: Settings,
	errorComponent: SettingsError,
	pendingComponent: SettingsPending,
});

/** schemaVersion 1 の最小例。必須の項目をすべて含む */
const exampleDocument = {
	schemaVersion: 1,
	title: "バナナケーキ",
	categorySlug: "sweets",
	summary: "熟したバナナで作る、混ぜて焼くだけのケーキです。",
	servings: { value: 1, unit: "台" },
	times: { prepMinutes: 15, cookMinutes: 40, restMinutes: null },
	ingredients: [
		{
			name: "バナナ",
			amount: { value: 2, unit: "本" },
			note: "よく熟したものを使います",
			ingredientId: null,
		},
		{
			name: "薄力粉",
			amount: { value: 100, unit: "g" },
			note: null,
			ingredientId: null,
		},
	],
	steps: [
		{ text: "バナナをつぶして、他の材料と混ぜます。" },
		{ text: "170℃のオーブンで 40 分焼きます。" },
	],
	references: [
		{
			title: "みんなのケーキ",
			url: "https://example.com/banana-cake",
			note: "砂糖の量だけ減らしています",
		},
	],
	tags: ["おやつ"],
	note: null,
};

function Settings() {
	const { categories } = Route.useLoaderData();
	const router = useRouter();
	const submit = useServerFn(submitCategory);
	const remove = useServerFn(removeCategory);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const createCategory = async () => {
		setCreateError(null);
		if (name.trim().length === 0 || slug.trim().length === 0) {
			setCreateError("名前と slug を入力してください。");
			return;
		}
		setIsCreating(true);
		try {
			const result = await submit({
				data: { categoryId: null, input: { name, slug } },
			});
			if (!result.ok) {
				setCreateError(result.message);
				return;
			}
			setName("");
			setSlug("");
			await router.invalidate();
		} finally {
			setIsCreating(false);
		}
	};

	const deleteCategory = async (categoryId: string) => {
		setDeleteError(null);
		setRemovingId(categoryId);
		try {
			const result = await remove({ data: { categoryId } });
			if (!result.ok) {
				setDeleteError(result.message);
				return;
			}
			await router.invalidate();
		} finally {
			setRemovingId(null);
		}
	};

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div>
				<h1 className="text-2xl font-bold">設定</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					レシピの種類、レシピ JSON の形式、ログインについてまとめています。
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>レシピの種類</CardTitle>
					<CardDescription>
						レシピを分類する種類です。名前を変えたいときは、新しい種類を追加してから元の種類を削除します。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{deleteError ? (
						<Alert variant="destructive">
							<AlertDescription>{deleteError}</AlertDescription>
						</Alert>
					) : null}

					{categories.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							種類がまだありません。
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>名前</TableHead>
									<TableHead>slug</TableHead>
									<TableHead>操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{categories.map((category) => (
									<TableRow key={category.id}>
										<TableCell className="font-medium">
											{category.name}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{category.slug}</Badge>
										</TableCell>
										<TableCell>
											<Button
												aria-label={`${category.name} を削除`}
												disabled={removingId === category.id}
												onClick={() => void deleteCategory(category.id)}
												size="sm"
												type="button"
												variant="destructive"
											>
												<TrashIcon />
												{removingId === category.id
													? "削除しています…"
													: "削除"}
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}

					<form
						className="flex flex-wrap items-end gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void createCategory();
						}}
					>
						<div className="grid gap-2">
							<Label htmlFor="category-name">名前</Label>
							<Input
								id="category-name"
								maxLength={50}
								onChange={(event) => setName(event.target.value)}
								placeholder="例: お菓子"
								value={name}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="category-slug">slug</Label>
							<Input
								id="category-slug"
								maxLength={50}
								onChange={(event) => setSlug(event.target.value)}
								placeholder="例: sweets"
								value={slug}
							/>
						</div>
						<Button disabled={isCreating} type="submit">
							{isCreating ? "追加しています…" : "追加"}
						</Button>
						<p className="w-full text-sm text-muted-foreground">
							slug は英小文字・数字・ハイフンで入力します。
						</p>
					</form>

					{createError ? (
						<Alert variant="destructive">
							<AlertDescription>{createError}</AlertDescription>
						</Alert>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>レシピ JSON</CardTitle>
					<CardDescription>
						レシピは JSON でも受け付けます。形式は{" "}
						<a
							className="text-primary underline-offset-4 hover:underline"
							href="/schemas/recipe-v1.json"
							rel="noreferrer"
							target="_blank"
						>
							/schemas/recipe-v1.json
						</a>
						（JSON Schema）で確認できます。取り込みは「レシピ →
						新しいレシピ」から行えます。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<p className="text-sm text-muted-foreground">
						schemaVersion: 1 の最小例です。
					</p>
					<pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
						{JSON.stringify(exampleDocument, null, 2)}
					</pre>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>ログイン</CardTitle>
					<CardDescription>
						Discord アカウントでログインしています。
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
					<p>
						登録を許可するには、<code>ALLOWED_DISCORD_USER_IDS</code> に Discord
						のユーザー id を追加します。
					</p>
					<p>ログアウトはサイドバーから行えます。</p>
				</CardContent>
			</Card>
		</main>
	);
}

function SettingsError({ error, reset }: ErrorComponentProps) {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Card>
				<CardHeader>
					<CardTitle>設定を読み込めませんでした</CardTitle>
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

function SettingsPending() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<p className="text-sm text-muted-foreground">読み込んでいます…</p>
		</main>
	);
}
