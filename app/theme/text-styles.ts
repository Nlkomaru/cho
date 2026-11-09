import { defineTextStyles } from "@chakra-ui/react";

/**
 * 組版の単一の情報源。画面側は fontSize / lineHeight を直接書かず、
 * ここの textStyle を指定する。大きな見出しほど字間を詰める。
 * `body` と `body.sm` のように親子で名前を持たせるため、ドット付きのキーで平らに定義する。
 */
export const textStyles = defineTextStyles({
  display: {
    value: {
      fontFamily: "heading",
      fontSize: { base: "28px", md: "36px" },
      lineHeight: { base: "36px", md: "44px" },
      fontWeight: "500",
      letterSpacing: "-0.02em",
    },
  },
  heading: {
    page: {
      value: {
        fontFamily: "heading",
        fontSize: { base: "24px", md: "30px" },
        lineHeight: { base: "32px", md: "38px" },
        fontWeight: "500",
        letterSpacing: "-0.02em",
      },
    },
    section: {
      value: {
        fontFamily: "heading",
        fontSize: "20px",
        lineHeight: "28px",
        fontWeight: "500",
        letterSpacing: "-0.01em",
      },
    },
    card: {
      value: {
        fontFamily: "heading",
        fontSize: "16px",
        lineHeight: "24px",
        fontWeight: "600",
        letterSpacing: "0",
      },
    },
    group: {
      value: {
        fontFamily: "heading",
        fontSize: "14px",
        lineHeight: "20px",
        fontWeight: "600",
        letterSpacing: "0",
      },
    },
  },
  body: {
    value: {
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: "400",
      letterSpacing: "0",
    },
  },
  "body.lg": {
    value: {
      fontSize: "16px",
      lineHeight: "27px",
      fontWeight: "400",
      letterSpacing: "0",
    },
  },
  "body.sm": {
    value: {
      fontSize: "14px",
      lineHeight: "22px",
      fontWeight: "400",
      letterSpacing: "0",
    },
  },
  label: {
    value: {
      fontSize: "13px",
      lineHeight: "18px",
      fontWeight: "500",
      letterSpacing: "0",
    },
  },
  caption: {
    value: {
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: "400",
      letterSpacing: "0",
    },
  },
  stat: {
    value: {
      fontSize: { base: "24px", md: "28px" },
      lineHeight: { base: "30px", md: "34px" },
      fontWeight: "500",
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums",
    },
  },
  "stat.sm": {
    value: {
      fontSize: "18px",
      lineHeight: "24px",
      fontWeight: "500",
      letterSpacing: "-0.01em",
      fontVariantNumeric: "tabular-nums",
    },
  },
  mono: {
    value: {
      fontFamily: "mono",
      fontSize: "13px",
      lineHeight: "20px",
      fontWeight: "400",
      letterSpacing: "0",
    },
  },
});
