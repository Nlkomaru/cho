import {
	createFileRoute,
	Link,
	Outlet,
	useChildMatches,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	ExternalLinkIcon,
	Loader2Icon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ImageUploader, type UploadedImage } from "@/components/image-uploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { CookDetail } from "@/domain/cook";
import { formatJstDateTime } from "@/lib/datetime";
import { fetchCook, removeCook } from "@/server/cooks.functions";
import { fetchRecipe } from "@/server/recipes.functions";

export const Route = createFileRoute("/_app/cooks/$cookId")({
	loader: async ({ params }) => {
		const cook = await fetchCook({ data: { cookId: params.cookId } });
		if (cook === null) {
			return {
				cook: null,
				categoryName: null,
				breadcrumbs: [
					{ label: "作った記録", to: "/" },
					{ label: "記録が見つかりません" },
				],
			};
		}
		const recipe = await fetchRecipe({ data: { recipeId: cook.recipeId } });
		return {
			cook,
			categoryName: recipe?.categoryName ?? null,
			breadcrumbs: [
				{ label: "作った記録", to: "/" },
				{ label: cook.recipeTitle },
			],
		};
	},
	component: CookDetailPage,
});

function CookDetailPage() {
	const { cook, categoryName } = Route.useLoaderData();
	// 編集画面（`/cooks/$cookId/edit`）はこの route の子なので、子が居るときは子に描かせる
	const childCount = useChildMatches({ select: (matches) => matches.length });

	if (childCount > 0) {
		return <Outlet />;
	}

	if (cook === null) {
		return <CookNotFound />;
	}

	return <CookDetailView categoryName={categoryName} cook={cook} />;
}

function CookDetailView({
	cook,
	categoryName,
}: {
	readonly cook: CookDetail;
	readonly categoryName: string | null;
}) {
	const router = useRouter();
	const navigate = useNavigate();
	const remove = useServerFn(removeCook);
	const [images, setImages] = useState<readonly UploadedImage[]>(cook.images);
	const [error, setError] = useState<string | null>(null);
	const [isRemoving, setIsRemoving] = useState(false);

	const handleRemove = async () => {
		if (
			!window.confirm(
				"この記録を削除します。追加した写真も一緒に削除されます。よろしいですか？",
			)
		) {
			return;
		}
		setIsRemoving(true);
		setError(null);
		try {
			const result = await remove({ data: { cookId: cook.id } });
			if (!result.ok) {
				setError(result.message);
				return;
			}
			await router.invalidate();
			await navigate({ to: "/" });
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "記録を削除できませんでした。",
			);
		} finally {
			setIsRemoving(false);
		}
	};

	const note = cook.note?.trim() ?? "";

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-bold">{cook.recipeTitle}</h1>
					<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<time dateTime={cook.cookedAt}>
							{formatJstDateTime(cook.cookedAt)}
						</time>
						{categoryName === null ? null : (
							<Badge variant="secondary">{categoryName}</Badge>
						)}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						className={buttonVariants({ variant: "outline" })}
						params={{ cookId: cook.id }}
						to="/cooks/$cookId/edit"
					>
						<PencilIcon />
						編集
					</Link>
					<Button
						disabled={isRemoving}
						onClick={handleRemove}
						type="button"
						variant="destructive"
					>
						{isRemoving ? (
							<Loader2Icon className="animate-spin" />
						) : (
							<Trash2Icon />
						)}
						削除
					</Button>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>削除できませんでした</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>記録の内容</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<p className="text-sm text-muted-foreground">レシピ</p>
						<Link
							className="text-primary underline-offset-4 hover:underline"
							params={{ recipeId: cook.recipeId }}
							to="/recipes/$recipeId"
						>
							{cook.recipeTitle}
						</Link>
					</div>
					<div className="flex flex-col gap-2">
						<p className="text-sm text-muted-foreground">評価</p>
						{cook.rating === null ? (
							<p className="text-sm">未評価</p>
						) : (
							<p
								aria-label={`評価 ${cook.rating}（5 段階）`}
								className="text-amber-600"
								role="img"
							>
								{"★".repeat(cook.rating)}
							</p>
						)}
					</div>
					<div className="flex flex-col gap-2">
						<p className="text-sm text-muted-foreground">感想</p>
						{note === "" ? (
							<p className="text-sm text-muted-foreground">
								まだ書いていません。
							</p>
						) : (
							<p className="text-sm whitespace-pre-wrap">{note}</p>
						)}
					</div>
					{cook.instagramUrl === null ? null : (
						<div className="flex flex-col gap-2">
							<p className="text-sm text-muted-foreground">Instagram</p>
							<a
								className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
								href={cook.instagramUrl}
								rel="noreferrer"
								target="_blank"
							>
								投稿を開く
								<ExternalLinkIcon aria-hidden="true" className="size-3.5" />
							</a>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>写真</CardTitle>
					<CardDescription>
						この記録に写真を追加できます。追加した写真はすぐに保存されます。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ImageUploader
						images={images}
						onChange={setImages}
						ownerId={cook.id}
						scope="cook"
					/>
				</CardContent>
			</Card>
		</main>
	);
}

function CookNotFound() {
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<Card>
				<CardHeader>
					<CardTitle>記録が見つかりません</CardTitle>
					<CardDescription>
						削除されたか、URL が正しくない可能性があります。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Link className={buttonVariants()} to="/">
						作った記録の一覧へ
					</Link>
				</CardContent>
			</Card>
		</main>
	);
}
