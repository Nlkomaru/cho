import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppSidebar } from "@/components/app-sidebar";

const meta = {
	title: "Navigation/App Sidebar",
	component: AppSidebar,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		user: { name: "nikomaru", email: "nikomaru@example.com" },
		pathname: "/recipes",
		onSignOut: () => undefined,
	},
	decorators: [
		(Story) => (
			<div className="h-svh">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** レシピを開いている状態 */
export const Default: Story = {};

/** ログアウト中の表示 */
export const SigningOut: Story = {
	args: {
		isSigningOut: true,
	},
};
