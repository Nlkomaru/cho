import { CloseButton, Dialog, Portal, SimpleGrid, chakra } from "@chakra-ui/react";
import { useState } from "react";

import { imageUrl } from "./meal-shared";

export interface MealPhotoGalleryProps {
  imageIds: readonly string[];
  /** 代替テキストの元にする料理名。 */
  title: string;
  /** 画像 ID から表示 URL を作る。既定は画像 API。 */
  resolveSrc?(id: string): string;
}

/**
 * 食事の写真。正方形のタイルを並べ、押すと大きく表示する。
 */
export function MealPhotoGallery({
  imageIds,
  title,
  resolveSrc = imageUrl,
}: MealPhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openId = openIndex === null ? null : imageIds[openIndex];

  return (
    <>
      <SimpleGrid
        as="ul"
        aria-label="写真"
        listStyle="none"
        m="0"
        p="0"
        columns={{ base: 2, md: 4 }}
        gap={{ base: "2", md: "4" }}
      >
        {imageIds.map((id, index) => (
          <li key={id}>
            <chakra.button
              type="button"
              aria-label={`写真 ${index + 1} を拡大`}
              onClick={() => setOpenIndex(index)}
              display="block"
              w="full"
              aspectRatio="1"
              bg="bg.muted"
              overflow="hidden"
              cursor="zoom-in"
              _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
              css={{ "&:hover img": { transform: "scale(1.02)" } }}
            >
              <chakra.img
                src={resolveSrc(id)}
                alt={`${title}の写真 ${index + 1}`}
                w="full"
                h="full"
                objectFit="cover"
                transition="transform 160ms"
              />
            </chakra.button>
          </li>
        ))}
      </SimpleGrid>
      <Dialog.Root
        open={openId !== null}
        onOpenChange={(details) => {
          if (!details.open) setOpenIndex(null);
        }}
        size="xl"
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {title}の写真 {openIndex === null ? "" : openIndex + 1}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {openId ? (
                  <chakra.img
                    src={resolveSrc(openId)}
                    alt={`${title}の写真 ${(openIndex ?? 0) + 1}`}
                    w="full"
                    maxH="75vh"
                    objectFit="contain"
                    bg="bg.subtle"
                  />
                ) : null}
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" variant="ghost" aria-label="閉じる" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
