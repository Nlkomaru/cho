import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
	staticData: {
		breadcrumbs: [{ label: "記録一覧" }],
	},
	component: Home,
});

function Home() {
	return (
		<main className="p-8">
			<h1 className="text-4xl font-bold">調理記録</h1>
			<p className="mt-4 text-lg text-muted-foreground">
				作った料理やお菓子の記録を、ここから振り返れます。
			</p>
		</main>
	);
}
