import { NativeSelect } from "@chakra-ui/react";
import type { ComponentProps } from "react";

/**
 * Chakra NativeSelect のラッパー。multiple などネイティブ select の
 * セマンティクスが必要な編集フォームで使う。
 */
export function SelectControl(props: ComponentProps<"select">) {
  return (
    <NativeSelect.Root>
      <NativeSelect.Field {...props} />
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
