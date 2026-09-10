import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";

import licenseGroups from "./-data.json";

export const Route = createFileRoute("/_app/license/")({
	staticData: {
		breadcrumbs: [{ label: "OSS ライセンス" }],
	},
	component: LicensePage,
});

function LicensePage() {
	return (
		<main className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
			<header className="space-y-2">
				<h1 className="text-3xl text-primary">OSS ライセンス</h1>
				<p className="text-muted-foreground">
					Cho で利用しているオープンソースソフトウェアの一覧です。
				</p>
			</header>
			{licenseGroups.map((group) => (
				<section className="space-y-3" key={group.license}>
					<div>
						<h2 className="text-xl">{group.license}</h2>
						<p className="text-sm text-muted-foreground">
							{group.packages.length} パッケージ
						</p>
					</div>
					<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{group.packages.map((packageInfo) => (
							<li
								className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
								key={`${packageInfo.name}-${packageInfo.versions.join("-")}`}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<h3 className="break-all text-base">{packageInfo.name}</h3>
										<p className="text-sm text-muted-foreground">
											{packageInfo.versions
												.map((version) => `v${version}`)
												.join(", ")}
										</p>
									</div>
									{packageInfo.homepage ? (
										<a
											aria-label={`${packageInfo.name} のサイトを新しいタブで開く`}
											className="shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
											href={packageInfo.homepage}
											rel="noreferrer"
											target="_blank"
										>
											<ExternalLinkIcon aria-hidden="true" className="size-4" />
										</a>
									) : null}
								</div>
								<p className="mt-3 text-sm text-muted-foreground">
									Author: {packageInfo.author ?? "Unknown"}
								</p>
							</li>
						))}
					</ul>
				</section>
			))}
		</main>
	);
}
