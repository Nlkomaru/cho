import {
	createFileRoute,
	Outlet,
	redirect,
	useMatches,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { breadcrumbsFromLoaderData } from "@/lib/breadcrumbs";
import { fetchSessionUser } from "@/server/session.functions";

export const Route = createFileRoute("/_app")({
	// 記録は自分専用なので、ログインしていない相手には画面を返さない
	beforeLoad: async ({ location }) => {
		const user = await fetchSessionUser();
		if (!user) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { user };
	},
	component: AppLayout,
});

function AppLayout() {
	const { user } = Route.useRouteContext();
	const router = useRouter();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [isSigningOut, setIsSigningOut] = useState(false);

	const signOut = async () => {
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			await router.invalidate();
		} finally {
			setIsSigningOut(false);
		}
	};

	return (
		<SidebarProvider>
			<AppSidebar
				isSigningOut={isSigningOut}
				onSignOut={signOut}
				pathname={pathname}
				user={user}
			/>
			<SidebarInset>
				<header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b bg-background px-4">
					<SidebarTrigger className="ml-1" />
					<Separator
						orientation="vertical"
						className="my-auto mr-4 ml-2 h-8 py-[2px]"
					/>
					<AppBreadcrumb />
				</header>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}

function AppBreadcrumb() {
	const breadcrumbs = useMatches({
		select: (matches) =>
			matches.flatMap(
				(match) =>
					breadcrumbsFromLoaderData(match.loaderData) ??
					match.staticData.breadcrumbs ??
					[],
			),
	});

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbs.map((breadcrumb, index) => {
					const isCurrent = index === breadcrumbs.length - 1;

					return (
						<Fragment key={`${breadcrumb.label}-${breadcrumb.to ?? "current"}`}>
							{index > 0 ? <BreadcrumbSeparator /> : null}
							<BreadcrumbItem>
								{isCurrent || !breadcrumb.to ? (
									<BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink
										render={
											// biome-ignore lint/a11y/useAnchorContent: Base UI forwards BreadcrumbLink children to this anchor.
											<a aria-label={breadcrumb.label} href={breadcrumb.to} />
										}
									>
										{breadcrumb.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
