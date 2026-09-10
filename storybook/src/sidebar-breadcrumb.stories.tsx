import type { Meta, StoryObj } from "@storybook/react-vite";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from "@/components/ui/sidebar";

const meta = {
	title: "Navigation/Sidebar and Breadcrumb",
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
	render: () => (
		<SidebarProvider defaultOpen>
			<Sidebar>
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size="lg"
								className="pl-3"
								render={<a aria-label="Cho ホーム" href="/" />}
							>
								Cho
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>調理記録</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive
										className="pl-3"
										render={<a aria-label="記録一覧" href="/" />}
									>
										記録一覧
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			<SidebarFooter className="mt-auto">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="pl-3"
							render={<a aria-label="OSS ライセンス" href="/license" />}
						>
							OSS ライセンス
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="pl-3"
							render={
								<a
									aria-label="GitHub（新しいタブで開く）"
									href="https://github.com/Nlkomaru/cho"
									rel="noreferrer"
									target="_blank"
								/>
							}
						>
							GitHub
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="pl-3"
							render={
								<a
									aria-label="Storybook（新しいタブで開く）"
									href="/storybook"
									rel="noreferrer"
									target="_blank"
								/>
							}
						>
							Storybook
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarSeparator />
				<div className="px-2 pt-4 text-xs leading-5 text-sidebar-foreground/70">
					<p>Deployed: 2026-09-10T12:00:00</p>
					<p>No right reserved.</p>
				</div>
			</SidebarFooter>
			</Sidebar>
			<SidebarInset>
				<header className="flex h-16 items-center gap-2 border-b px-4">
					<SidebarTrigger />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="/">調理記録</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>記録一覧</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</header>
			</SidebarInset>
		</SidebarProvider>
	),
};
