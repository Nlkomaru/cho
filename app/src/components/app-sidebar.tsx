"use client";

import { CookingPotIcon, ExternalLinkIcon, LogOutIcon } from "lucide-react";
import type * as React from "react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { navigationGroups, navigationResources } from "@/lib/navigation";

const deployedAt = import.meta.env.VITE_DEPLOYED_AT ?? "未デプロイ";

export interface AppSidebarUser {
	readonly name: string;
	readonly email: string;
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	readonly user: AppSidebarUser;
	/** 現在のパス。選択中の項目を強調する */
	readonly pathname: string;
	readonly onSignOut: () => void;
	readonly isSigningOut?: boolean;
}

export function AppSidebar({
	user,
	pathname,
	onSignOut,
	isSigningOut = false,
	...props
}: AppSidebarProps) {
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="pl-4"
							render={
								// biome-ignore lint/a11y/useAnchorContent: Base UI forwards SidebarMenuButton children to this anchor.
								<a aria-label="Cho ホーム" href="/" />
							}
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<CookingPotIcon className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">Cho</span>
								<span className="truncate text-xs">調理記録</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{navigationGroups.map((group) => (
					<SidebarGroup key={group.title}>
						<SidebarGroupLabel>{group.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											isActive={pathname === item.url}
											className="pl-4"
											render={
												// biome-ignore lint/a11y/useAnchorContent: Base UI forwards SidebarMenuButton children to this anchor.
												<a aria-label={item.title} href={item.url} />
											}
										>
											{item.title}
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="mt-auto">
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="flex items-center gap-2 px-4 py-2">
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs text-sidebar-foreground/70">
									{user.email}
								</span>
							</div>
						</div>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="pl-4"
							disabled={isSigningOut}
							onClick={onSignOut}
						>
							<LogOutIcon />
							{isSigningOut ? "ログアウトしています…" : "ログアウト"}
						</SidebarMenuButton>
					</SidebarMenuItem>
					{navigationResources.map((item) => {
						const isExternal =
							item.opensInNewTab ?? item.url.startsWith("https://");

						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									isActive={pathname === item.url}
									className="pl-4"
									render={
										// biome-ignore lint/a11y/useAnchorContent: Base UI forwards SidebarMenuButton children to this anchor.
										<a
											aria-label={
												isExternal
													? `${item.title}（新しいタブで開く）`
													: item.title
											}
											href={item.url}
											rel={isExternal ? "noreferrer" : undefined}
											target={isExternal ? "_blank" : undefined}
										/>
									}
								>
									{item.title}
									{isExternal ? <ExternalLinkIcon /> : null}
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
				<SidebarSeparator />
				<div className="px-2 pt-4 text-xs leading-5 text-sidebar-foreground/70">
					<p>Deployed: {deployedAt.split(".")[0]}</p>
					<p>No right reserved.</p>
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
