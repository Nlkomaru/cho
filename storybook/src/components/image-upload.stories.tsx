import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ImageUpload, type ImageUploadItem, useImageUploads } from "@/components/ui/image-upload";
import { useImageSrc } from "@/lib/images";

import { missingImageId, sampleImageIds, sampleImageSrc } from "../fixtures/images";
import { fakeUpload } from "../recipe-editor/fixtures";

const ready = (id: string): ImageUploadItem => ({
  key: id,
  id,
  src: sampleImageSrc(id),
  status: "ready",
});
const uploading = (id: string): ImageUploadItem => ({
  key: `upload-${id}`,
  src: sampleImageSrc(id),
  status: "uploading",
});
const failed = (id: string, error = "通信に失敗しました"): ImageUploadItem => ({
  key: `upload-${id}`,
  src: sampleImageSrc(id),
  status: "error",
  error,
});

/**
 * 画像の選択とアップロード状況。cover は表紙 (16:9 の 1 枚)、tiles は手順の写真 (正方形 4 列、最大 4 枚)。
 * 選んだ画像はその場でアップロードし、終わるまで保存はできない。失敗した画像は理由と「再試行」「外す」を出す。
 */
const meta = {
  title: "Components/ImageUpload",
  component: ImageUpload,
  args: {
    variant: "cover",
    label: "表紙画像",
    items: [],
    max: 1,
    onAdd: () => {},
    onRemove: () => {},
    onRetry: () => {},
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["cover", "tiles"] },
  },
  render: (args) => (
    <Box w="full" maxW={args.variant === "cover" ? "480px" : "560px"}>
      <ImageUpload {...args} />
    </Box>
  ),
} satisfies Meta<typeof ImageUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CoverEmpty: Story = {};

export const CoverUploading: Story = {
  args: { items: [uploading(sampleImageIds.curryCover)] },
};

export const CoverUploaded: Story = {
  args: { items: [ready(sampleImageIds.curryCover)] },
};

export const CoverError: Story = {
  args: { items: [failed(sampleImageIds.curryCover)] },
};

/** 形式・サイズの誤りは再試行できない。 */
export const CoverRejected: Story = {
  args: {
    items: [
      {
        ...failed(sampleImageIds.curryCover, "10MB を超える画像は使えません"),
        retryable: false,
      },
    ],
  },
};

/** 保存済みの画像が消えていたとき。 */
export const CoverMissing: Story = {
  args: { items: [{ ...ready(missingImageId), src: "data:image/png;base64," }] },
};

export const TilesEmpty: Story = {
  args: { variant: "tiles", label: "手順3 の写真", max: 4, items: [] },
};

export const TilesUploaded: Story = {
  args: {
    variant: "tiles",
    label: "手順3 の写真",
    max: 4,
    items: [ready(sampleImageIds.currySaute1), ready(sampleImageIds.currySaute2)],
  },
};

export const TilesUploading: Story = {
  args: {
    variant: "tiles",
    label: "手順3 の写真",
    max: 4,
    items: [ready(sampleImageIds.currySaute1), uploading(sampleImageIds.currySaute2)],
  },
};

export const TilesError: Story = {
  args: {
    variant: "tiles",
    label: "手順3 の写真",
    max: 4,
    items: [
      ready(sampleImageIds.currySaute1),
      failed(sampleImageIds.currySaute2),
      { ...failed(sampleImageIds.currySimmer, "この形式の画像は使えません"), retryable: false },
    ],
  },
};

/** 4 枚に達すると追加の枠が消える。 */
export const TilesFull: Story = {
  args: {
    variant: "tiles",
    label: "手順3 の写真",
    max: 4,
    items: [
      ready(sampleImageIds.curryCut),
      ready(sampleImageIds.currySaute1),
      ready(sampleImageIds.currySaute2),
      ready(sampleImageIds.currySimmer),
    ],
  },
};

export const Disabled: Story = {
  args: {
    variant: "tiles",
    label: "手順3 の写真",
    max: 4,
    disabled: true,
    items: [ready(sampleImageIds.currySaute1)],
  },
};

function InteractiveDemo() {
  const resolveSrc = useImageSrc();
  const [cover, setCover] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const images = useImageUploads({
    upload: fakeUpload,
    discard: async () => {},
    onUploaded(slot, id, release) {
      if (slot === "cover") {
        if (cover) release(cover);
        setCover(id);
      } else setPhotos((current) => [...current, id]);
    },
  });
  return (
    <Stack gap="8" w="full" maxW="560px">
      <Box maxW="480px">
        <ImageUpload
          variant="cover"
          label="表紙画像"
          items={images.itemsFor("cover", cover ? [cover] : [], resolveSrc)}
          onAdd={(files) => images.add("cover", files)}
          onRetry={images.retry}
          onRemove={(key) => {
            if (images.isPending(key)) images.cancel(key);
            else setCover(null);
          }}
        />
      </Box>
      <ImageUpload
        variant="tiles"
        label="手順1 の写真"
        max={4}
        items={images.itemsFor("step", photos, resolveSrc)}
        onAdd={(files) => images.add("step", files)}
        onRetry={images.retry}
        onRemove={(key) => {
          if (images.isPending(key)) images.cancel(key);
          else setPhotos((current) => current.filter((id) => id !== key));
        }}
      />
    </Stack>
  );
}

/** 画像を選ぶと 1.2 秒後にアップロード済みになる (API は呼ばない)。 */
export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
