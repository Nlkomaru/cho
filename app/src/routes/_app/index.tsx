import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { CookListItem } from "@/domain/cook";
import { formatJstDateTime } from "@/lib/datetime";
import { fetchCooks } from "@/server/cooks.functions";

export const Route = createFileRoute("/_app/")({
	staticData: {
		breadcrumbs: [{ label: "作った記録" }],
	},
	loader: async () => ({
		cooks: await fetchCooks({ data: { recipeId: null } }),
	}),
	component: CookListPage,
});

function CookListPage() {
	const { cooks } = Route.useLoaderData();

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">作った記録</h1>
					<p className="text-sm text-muted-foreground">
						作った料理やお菓子の記録です。写真と感想を残せます。
					</p>
				</div>
				<Link className={buttonVariants()} to="/cooks/new">
					<PlusIcon />
					記録を追加
				</Link>
			</div>

			{cooks.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>まだ記録がありません</CardTitle>
						<CardDescription>
							先にレシピを登録すると、作った記録を付けられます。
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-2">
						<Link className={buttonVariants()} to="/cooks/new">
							<PlusIcon />
							記録を追加
						</Link>
						<Link
							className={buttonVariants({ variant: "outline" })}
							to="/recipes/new"
						>
							レシピを登録する
						</Link>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					{cooks.map((cook) => (
						<CookCard cook={cook} key={cook.id} />
					))}
				</div>
			)}
		</main>
	);
}

function CookCard({ cook }: { readonly cook: CookListItem }) {
	const note = cook.note?.trim() ?? "";

	return (
		<Card className="relative gap-0 overflow-hidden py-0 transition-colors hover:bg-muted/40">
			<CardContent className="flex flex-col gap-2 p-4">
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<time dateTime={cook.cookedAt}>
						{formatJstDateTime(cook.cookedAt)}
					</time>
					<Badge variant="secondary">{cook.categoryName}</Badge>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-medium">{cook.recipeTitle}</h2>
					{cook.rating === null ? null : (
						<span
							aria-label={`評価 ${cook.rating}（5 段階）`}
							className="text-amber-600"
							role="img"
						>
							{"★".repeat(cook.rating)}
						</span>
					)}
				</div>
				{note === "" ? null : (
					<p className="line-clamp-2 text-sm text-muted-foreground">{note}</p>
				)}
				<div className="flex flex-wrap items-center justify-between gap-2">
					{cook.imageCount > 0 ? (
						<p className="text-sm text-muted-foreground">
							写真 {cook.imageCount} 枚
						</p>
					) : null}
					{cook.instagramUrl === null ? null : (
						<a
							className="relative z-10 inline-flex items-center gap-1 text-sm text-primary hover:underline"
							href={cook.instagramUrl}
							rel="noreferrer"
							target="_blank"
						>
							Instagram
							<ExternalLinkIcon aria-hidden="true" className="size-3.5" />
						</a>
					)}
				</div>
			</CardContent>
			<Link
				aria-label={`${cook.recipeTitle} の記録を見る`}
				className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				params={{ cookId: cook.id }}
				to="/cooks/$cookId"
			/>
		</Card>
	);
}
