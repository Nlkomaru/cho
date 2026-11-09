import { Box, Card as ChakraCard, type CardRootProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** plain はテーマで追加したバリアント。 */
type ChakraCardVariant = CardRootProps["variant"];

export interface CardProps {
  title?: ReactNode;
  /** タイトル下の補足 (日付・件数など)。 */
  meta?: ReactNode;
  /** 見出し行の右側に置く操作。 */
  actions?: ReactNode;
  /** 細罫の下に置くフッター (ボタンなど)。 */
  footer?: ReactNode;
  /** 本文より上に全幅で置く画像など。 */
  media?: ReactNode;
  /** outline: 白地 + 細罫 (既定)、subtle: 淡い地、plain: 枠も余白もなし。 */
  variant?: "outline" | "subtle" | "plain";
  padding?: "sm" | "md";
  /** 見出しと本文の間に細罫を引く (AISI のカード)。 */
  divider?: boolean;
  as?: "article" | "div" | "section" | "li";
  titleAs?: "h2" | "h3" | "h4";
  children?: ReactNode;
}

/**
 * カード。角を立てた白地 + 1px の細罫で、影は付けない。
 */
export function Card({
  title,
  meta,
  actions,
  footer,
  media,
  variant = "outline",
  padding = "md",
  divider = false,
  as = "div",
  titleAs = "h3",
  children,
}: CardProps) {
  const hasHeader = Boolean(title || meta || actions);

  return (
    <ChakraCard.Root
      as={as}
      variant={variant as ChakraCardVariant}
      size={padding}
      css={variant === "plain" ? { "--card-padding": "0px" } : undefined}
    >
      {media ? <Box overflow="hidden">{media}</Box> : null}
      {hasHeader ? (
        <ChakraCard.Header css={divider ? dividerCss : undefined}>
          <Box minW="0">
            {title ? <ChakraCard.Title as={titleAs}>{title}</ChakraCard.Title> : null}
            {meta ? <ChakraCard.Description as="div">{meta}</ChakraCard.Description> : null}
          </Box>
          {actions ? (
            <Box display="flex" gap="2" flexShrink={0}>
              {actions}
            </Box>
          ) : null}
        </ChakraCard.Header>
      ) : null}
      {children ? <ChakraCard.Body>{children}</ChakraCard.Body> : null}
      {footer ? <ChakraCard.Footer>{footer}</ChakraCard.Footer> : null}
    </ChakraCard.Root>
  );
}

const dividerCss = {
  paddingBottom: "var(--card-padding)",
  borderBottomWidth: "1px",
  borderColor: "border",
  marginInline: "var(--card-padding)",
  paddingInline: "0",
};
