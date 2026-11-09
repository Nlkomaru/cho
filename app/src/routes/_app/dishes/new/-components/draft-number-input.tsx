import { Input, InputGroup } from "@chakra-ui/react";
import { useState } from "react";

export interface DraftNumberInputProps {
  /** 保存する値。空欄は null。 */
  value: number | null;
  onChange(value: number | null): void;
  /** 表示用の文字列へ変換する (秒 → 分など)。 */
  format?(value: number | null): string;
  /** 入力文字列を保存する値へ変換する。 */
  parse?(value: number): number;
  unit?: string;
  id?: string;
  size?: "sm" | "md";
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const defaultFormat = (value: number | null) =>
  value === null || Number.isNaN(value) ? "" : String(value);

/**
 * 数値の入力欄。入力途中の "1." や空欄を保ったまま、確定した数値だけを親へ渡す。
 */
export function DraftNumberInput({
  value,
  onChange,
  format = defaultFormat,
  parse = (n) => n,
  unit,
  id,
  size = "md",
  invalid,
  ...aria
}: DraftNumberInputProps) {
  const [text, setText] = useState(() => format(value));
  const [seen, setSeen] = useState(value);

  // 親から別の値が来たときだけ表示を置き換える (入力中の "1." などは保つ)
  if (!Object.is(seen, value)) {
    setSeen(value);
    const parsed = text.trim() === "" ? null : Number(text);
    const same =
      parsed === null ? value === null : Number.isFinite(parsed) && parse(parsed) === value;
    if (!same) setText(format(value));
  }

  const input = (
    <Input
      id={id}
      size={size}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      aria-invalid={invalid || undefined}
      fontVariantNumeric="tabular-nums"
      onChange={(event) => {
        const next = event.currentTarget.value;
        setText(next);
        if (next.trim() === "") return onChange(null);
        const parsed = Number(next);
        if (Number.isFinite(parsed)) onChange(parse(parsed));
      }}
      {...aria}
    />
  );
  if (!unit) return input;
  return (
    <InputGroup
      endElement={unit}
      endElementProps={{ color: "fg.subtle", fontSize: "14px", pointerEvents: "none" }}
    >
      {input}
    </InputGroup>
  );
}
