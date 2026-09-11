import type { Meta, StoryObj } from "@storybook/react-vite";

import { ImageUploader } from "@/components/image-uploader";

const meta = {
	title: "Records/Image Uploader",
	component: ImageUploader,
	parameters: {
		layout: "padded",
	},
	args: {
		scope: "cook",
		ownerId: "00000000-0000-7000-8000-000000000000",
		images: [],
		onChange: () => undefined,
	},
} satisfies Meta<typeof ImageUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 写真がまだ無い状態。ここから追加する */
export const Empty: Story = {};

/**
 * 保存済みの写真がある状態。サムネイルは Worker の /images/* から配信するため、
 * Storybook では実画像の代わりに壊れた画像として表示される。
 */
export const WithImages: Story = {
	args: {
		images: [
			{
				id: "00000000-0000-7000-8000-000000000001",
				key: "cooks/00000000-0000-7000-8000-000000000000/00000000-0000-7000-8000-000000000002.jpg",
				alt: "焼き上がりの写真",
			},
		],
	},
};

export const Disabled: Story = {
	args: {
		disabled: true,
	},
};
