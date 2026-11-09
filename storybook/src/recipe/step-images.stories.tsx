import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { StepImages } from "@/components/recipe/recipe-image";

import { sampleImageIds } from "../fixtures/images";

const meta = {
  title: "Recipe/StepImages",
  component: StepImages,
  render: (args) => (
    <Box maxW="760px">
      <StepImages {...args} />
    </Box>
  ),
  args: {
    stepNumber: 2,
    imageIds: [sampleImageIds.currySaute1, sampleImageIds.currySaute2],
  },
} satisfies Meta<typeof StepImages>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Thumbnails: Story = {};

export const SinglePhoto: Story = {
  args: { imageIds: [sampleImageIds.curryCut], stepNumber: 1 },
};

/** 拡大表示。複数枚あるときは前後の写真に移れる。 */
export const LightboxOpen: Story = {
  args: { initialOpenIndex: 0 },
};

export const LightboxLastPhoto: Story = {
  args: { initialOpenIndex: 1 },
};
