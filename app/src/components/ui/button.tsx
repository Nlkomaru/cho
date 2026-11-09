import {
  Button as ChakraButton,
  type ButtonProps as ChakraButtonProps,
  IconButton as ChakraIconButton,
  type IconButtonProps as ChakraIconButtonProps,
} from "@chakra-ui/react";
import { forwardRef } from "react";

/**
 * テーマ (app/theme/recipes/button.ts) で定義したボタンの見た目。
 * - primary: 赤の塗り。1 画面に 1 つだけ。
 * - secondary: 紺の塗り。
 * - outline: 白地 + 罫線 (既定)。
 * - ghost: 背景なし。
 * - danger: 削除などの取り消せない操作。塗らない。
 * - link: 下線リンク風 ("すべて見る" など)。
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "2xs" | "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ChakraButtonProps, "variant" | "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export interface IconButtonProps extends Omit<ChakraIconButtonProps, "variant" | "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** アイコンだけのボタンには必ず読み上げ名を付ける。 */
  "aria-label": string;
}

type LooseVariant = ChakraButtonProps["variant"];
type LooseSize = ChakraButtonProps["size"];

/**
 * Chakra の Button に、テーマで追加したバリアントの型を付けたもの。
 * Chakra の型生成 (typegen) を使わずに primary / danger などを型安全に渡すための薄い層。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, ...props },
  ref,
) {
  // 読み込み中は文字が隠れるため、読み上げ名を文字列の children から補う
  const label =
    props.loading &&
    !props.loadingText &&
    !props["aria-label"] &&
    typeof props.children === "string"
      ? props.children
      : props["aria-label"];
  return (
    <ChakraButton
      ref={ref}
      variant={variant as LooseVariant}
      size={size as LooseSize}
      {...props}
      aria-label={label}
    />
  );
});

/** 正円のアイコンボタン。高さは同じサイズの Button と揃う。 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant, size, ...props },
  ref,
) {
  return (
    <ChakraIconButton
      ref={ref}
      variant={variant as LooseVariant}
      size={size as LooseSize}
      {...props}
    />
  );
});
