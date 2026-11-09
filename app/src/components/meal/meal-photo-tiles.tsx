import { Box, SimpleGrid, chakra } from "@chakra-ui/react";
import { ImagePlus, X } from "lucide-react";
import { useId } from "react";

import { acceptedImageTypes } from "@/lib/images";

export interface MealPhoto {
  key: string;
  /** 表示用 URL (アップロード済みの画像 URL か、選択中ファイルの object URL)。 */
  src: string;
}

export interface MealPhotoTilesProps {
  photos: readonly MealPhoto[];
  onAdd(files: File[]): void;
  onRemove(key: string): void;
  max?: number;
  disabled?: boolean;
  /** 追加タイルの読み上げ名に使う。 */
  label?: string;
}

export { acceptedImageTypes };

/**
 * 写真の選択。正方形のタイルを 4 列に並べ、最後に破線の追加タイルを置く。
 */
export function MealPhotoTiles({
  photos,
  onAdd,
  onRemove,
  max = 4,
  disabled,
  label = "写真",
}: MealPhotoTilesProps) {
  const inputId = useId();
  const remaining = max - photos.length;

  return (
    <Box w="full">
      <SimpleGrid columns={4} gap="2">
        {photos.map((photo, index) => (
          <Box key={photo.key} position="relative" aspectRatio="1" bg="bg.muted" overflow="hidden">
            <chakra.img
              src={photo.src}
              alt={`${label} ${index + 1}`}
              w="full"
              h="full"
              objectFit="cover"
            />
            <chakra.button
              type="button"
              aria-label={`${label} ${index + 1} を外す`}
              disabled={disabled}
              onClick={() => onRemove(photo.key)}
              position="absolute"
              top="1"
              insetEnd="1"
              boxSize="6"
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              bg="white"
              color="fg.strong"
              boxShadow="0 0 0 1px {colors.border}"
              cursor="pointer"
              _hover={{ bg: "navy.100" }}
              _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </chakra.button>
          </Box>
        ))}
        {remaining > 0 ? (
          <chakra.label
            htmlFor={inputId}
            aspectRatio="1"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="1"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.emphasized"
            color="fg.muted"
            textStyle="caption"
            cursor={disabled ? "not-allowed" : "pointer"}
            opacity={disabled ? 0.4 : 1}
            _hover={disabled ? undefined : { bg: "navy.50", color: "fg.strong" }}
            css={{
              "&:has(input:focus-visible)": {
                outline: "2px solid {colors.navy.900}",
                outlineOffset: "2px",
              },
            }}
          >
            <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>追加</span>
            <chakra.input
              id={inputId}
              type="file"
              accept={acceptedImageTypes}
              multiple
              disabled={disabled}
              aria-label={`${label}を追加`}
              srOnly
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []).slice(0, remaining);
                event.currentTarget.value = "";
                if (files.length) onAdd(files);
              }}
            />
          </chakra.label>
        ) : null}
      </SimpleGrid>
    </Box>
  );
}
