import { defineTokens } from "@chakra-ui/react";

const sans =
  '"Onest", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';

/**
 * 欧文と数字は Onest、かなと漢字は Noto Sans JP が受け持つ。
 * 韓国語など Noto Sans JP に無い文字は OS のフォントに任せる。
 * 数字は等幅フォントにせず tabular-nums で桁を揃える。
 */
export const fonts = defineTokens.fonts({
  heading: { value: sans },
  body: { value: sans },
  mono: {
    value: '"JetBrains Mono", "Noto Sans JP", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
});
