import { Box, chakra } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "./button";
import { toaster } from "./toaster";

export interface CodeBlockProps {
  code: string;
  /** コピーボタンと領域の aria-label に使う名前。 */
  label: string;
  language?: string;
  /** コピーボタンを出すか。既定は出す。 */
  copyable?: boolean;
}

/**
 * コード・設定値の表示。右上のボタンでクリップボードにコピーする。
 */
export function CodeBlock({ code, label, language, copyable = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toaster.create({ type: "success", title: "コピーしました" });
    } catch {
      toaster.create({ type: "error", title: "コピーできませんでした" });
    }
  };

  return (
    <Box position="relative" role="group" aria-label={label}>
      <chakra.pre
        m="0"
        p="4"
        pe={copyable ? "14" : "4"}
        bg="bg.subtle"
        borderRadius="l2"
        borderWidth="1px"
        borderColor="border"
        overflowX="auto"
        textStyle="mono"
        color="fg.strong"
        tabIndex={0}
        data-language={language}
        _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
      >
        <code>{code}</code>
      </chakra.pre>
      {copyable ? (
        <IconButton
          position="absolute"
          top="2"
          insetEnd="2"
          size="xs"
          variant="outline"
          aria-label={`${label}をコピー`}
          onClick={() => void copy()}
        >
          {copied ? <Check strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}
        </IconButton>
      ) : null}
    </Box>
  );
}
