import { defineTokens } from "@chakra-ui/react";

/**
 * ページコンテナの最大幅。一覧・詳細は `page.lg`、フォームや設定は `page.md`。
 */
export const sizes = defineTokens.sizes({
  page: {
    sm: { value: "720px" },
    md: { value: "960px" },
    lg: { value: "1280px" },
  },
});
