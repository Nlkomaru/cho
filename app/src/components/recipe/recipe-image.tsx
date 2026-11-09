import { Box, Button, CloseButton, Dialog, Portal, Stack, chakra } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useImageSrc } from "@/lib/images";

export interface RecipeCoverProps {
  imageId: string;
  /** 代替テキストに使う料理名。 */
  title: string;
}

/**
 * レシピ詳細の表紙画像。16:9 で切り抜き、読み込めなければ何も出さない。
 */
export function RecipeCover({ imageId, title }: RecipeCoverProps) {
  const resolveSrc = useImageSrc();
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageId]);
  if (broken) return null;
  return (
    <Box bg="bg.muted" overflow="hidden" aspectRatio="16 / 9" maxH="360px" w="full">
      <chakra.img
        src={resolveSrc(imageId)}
        alt={`${title}の写真`}
        w="full"
        h="full"
        objectFit="cover"
        onError={() => setBroken(true)}
      />
    </Box>
  );
}

function StepThumb({ src, alt, onOpen }: { src: string; alt: string; onOpen(): void }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <chakra.button
      type="button"
      aria-label={`${alt}を拡大`}
      onClick={onOpen}
      disabled={broken}
      display="block"
      boxSize={{ base: "20", md: "24" }}
      flexShrink="0"
      bg="bg.muted"
      overflow="hidden"
      cursor={broken ? "default" : "zoom-in"}
      _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
      css={{ "&:hover img": { transform: "scale(1.03)" } }}
    >
      {broken ? (
        <Stack
          h="full"
          align="center"
          justify="center"
          gap="1"
          px="1"
          color="fg.subtle"
          textStyle="caption"
          textAlign="center"
        >
          <ImageOff size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>画像を表示できません</span>
        </Stack>
      ) : (
        <chakra.img
          src={src}
          alt={alt}
          w="full"
          h="full"
          objectFit="cover"
          loading="lazy"
          transition="transform 160ms"
          onError={() => setBroken(true)}
        />
      )}
    </chakra.button>
  );
}

export interface StepImagesProps {
  imageIds: readonly string[];
  stepNumber: number;
  /** 最初から拡大表示する写真の位置。Storybook など表示確認用。 */
  initialOpenIndex?: number;
}

/**
 * 手順の写真。正方形のサムネイルを横に並べ、押すと大きく表示する。
 */
export function StepImages({ imageIds, stepNumber, initialOpenIndex }: StepImagesProps) {
  const resolveSrc = useImageSrc();
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex ?? null);
  const openId = openIndex === null ? null : (imageIds[openIndex] ?? null);
  const move = (offset: number) =>
    setOpenIndex((current) => (current === null ? null : current + offset));
  const alt = (index: number) => `手順${stepNumber} の写真 ${index + 1}`;

  return (
    <>
      <chakra.ul
        aria-label={`手順${stepNumber} の写真`}
        listStyle="none"
        m="0"
        p="0"
        display="flex"
        flexWrap="wrap"
        gap="2"
      >
        {imageIds.map((id, index) => (
          <li key={id}>
            <StepThumb src={resolveSrc(id)} alt={alt(index)} onOpen={() => setOpenIndex(index)} />
          </li>
        ))}
      </chakra.ul>
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
                <Dialog.Title>{openIndex === null ? "" : alt(openIndex)}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {openId ? (
                  <chakra.img
                    src={resolveSrc(openId)}
                    alt={alt(openIndex ?? 0)}
                    w="full"
                    maxH="75vh"
                    objectFit="contain"
                    bg="bg.subtle"
                  />
                ) : null}
              </Dialog.Body>
              {openIndex !== null && imageIds.length > 1 ? (
                <Dialog.Footer justifyContent="space-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => move(-1)}
                    disabled={openIndex === 0}
                  >
                    <ChevronLeft aria-hidden="true" />
                    前の写真
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => move(1)}
                    disabled={openIndex === imageIds.length - 1}
                  >
                    次の写真
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </Dialog.Footer>
              ) : null}
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
