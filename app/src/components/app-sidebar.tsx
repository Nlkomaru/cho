"use client";

import { useRouterState } from "@tanstack/react-router";
import { CookingPotIcon } from "lucide-react";
import type * as React from "react";

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { navigationGroups } from "@/lib/navigation";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
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
			<SidebarRail />
		</Sidebar>
	);
}
