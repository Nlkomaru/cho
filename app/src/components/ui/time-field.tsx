import { Input } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Field } from "./field";

export interface TimeFieldProps {
  label: string;
  /** `HH:mm` (24 時間表記)。空文字は未入力。 */
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  /** 既定 "18:30"。 */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
}

/**
 * "1830" / "18:30" / "9:5" / "9" のような入力を `HH:mm` にそろえる。読めない値は null。
 */
export function normalizeTime(input: string): string | null {
  const text = input
    .trim()
    .replace(/[：.．]/g, ":")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  if (text === "") return "";
  const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(text) ?? /^(\d{1,2})(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 24 時間表記の時刻入力。ブラウザの `type="time"` はロケールで AM/PM 表記になるため、
 * テキスト入力で受け取り、フォーカスが外れたときに `HH:mm` へ整える。
 */
export function TimeField({
  label,
  value,
  onChange,
  helperText,
  placeholder = "18:30",
  required,
  disabled,
  size = "md",
  id,
}: TimeFieldProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const normalized = normalizeTime(draft);
    if (normalized === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(normalized);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <Field
      label={label}
      helperText={helperText}
      errorText={invalid ? "00:00〜23:59 で入力してください" : undefined}
      required={required}
      disabled={disabled}
      id={id}
    >
      <Input
        size={size}
        value={draft}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        maxLength={5}
        fontVariantNumeric="tabular-nums"
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          // "18:30" まで打てば確定を待たずに反映する (Enter で送信したときに古い値を送らない)
          const complete = /^\d{2}:\d{2}$/.test(next) ? normalizeTime(next) : null;
          if (complete && complete !== value) {
            setInvalid(false);
            onChange(complete);
          }
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </Field>
  );
}
