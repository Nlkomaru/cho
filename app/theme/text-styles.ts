import { defineTextStyles } from "@chakra-ui/react";

/**
 * タイポグラフィ規則 (spec/02_design-system.md §2.2)
 * - 見出し: semibold / `fg.subtle` (#000000)
 * - 本文: normal / `fg` (#3f3f46)
 * - 数値・単位・日時: JetBrains Mono + `tabular-nums` で桁を揃える
 */
export const textStyles = defineTextStyles({
  heading: {
    lg: {
      value: {
        fontFamily: "heading",
        fontSize: "2xl",
        fontWeight: "semibold",
        lineHeight: "1.3",
        color: "fg.subtle",
      },
    },
    md: {
      value: {
        fontFamily: "heading",
        fontSize: "xl",
        fontWeight: "semibold",
        lineHeight: "1.35",
        color: "fg.subtle",
      },
    },
    sm: {
      value: {
        fontFamily: "heading",
        fontSize: "lg",
        fontWeight: "semibold",
        lineHeight: "1.4",
        color: "fg.subtle",
      },
    },
    xs: {
      value: {
        fontFamily: "heading",
        fontSize: "md",
        fontWeight: "semibold",
        lineHeight: "1.4",
        color: "fg.subtle",
      },
    },
  },
  body: {
    DEFAULT: {
      value: {
        fontFamily: "body",
        fontSize: "md",
        fontWeight: "normal",
        lineHeight: "1.6",
        color: "fg",
      },
    },
    sm: {
      value: {
        fontFamily: "body",
        fontSize: "sm",
        fontWeight: "normal",
        lineHeight: "1.6",
        color: "fg",
      },
    },
  },
  caption: {
    value: {
      fontFamily: "body",
      fontSize: "sm",
      fontWeight: "normal",
      lineHeight: "1.5",
      color: "fg.muted",
    },
  },
  label: {
    value: {
      fontFamily: "body",
      fontSize: "sm",
      fontWeight: "semibold",
      lineHeight: "1.5",
      color: "fg.subtle",
    },
  },
  caution: {
    value: {
      fontFamily: "body",
      fontSize: "sm",
      fontWeight: "normal",
      lineHeight: "1.6",
      color: "red.fg",
    },
  },
  numeric: {
    DEFAULT: {
      value: {
        fontFamily: "mono",
        fontVariantNumeric: "tabular-nums",
        color: "fg",
      },
    },
    sm: {
      value: {
        fontFamily: "mono",
        fontSize: "sm",
        fontVariantNumeric: "tabular-nums",
        color: "fg",
      },
    },
    xs: {
      value: {
        fontFamily: "mono",
        fontSize: "xs",
        fontVariantNumeric: "tabular-nums",
        color: "fg.muted",
      },
    },
    strong: {
      value: {
        fontFamily: "mono",
        fontWeight: "semibold",
        fontVariantNumeric: "tabular-nums",
        color: "fg.subtle",
      },
    },
  },
});
