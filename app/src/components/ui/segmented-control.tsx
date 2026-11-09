import { SegmentGroup } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface SegmentedControlItem<T extends string> {
  value: T;
  label: ReactNode;
  /** アイコンだけを見せる場合の読み上げ名。 */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange(value: NoInfer<T>): void;
  items: readonly SegmentedControlItem<NoInfer<T>>[];
  /** グループの aria-label。 */
  label: string;
  size?: "xs" | "sm" | "md";
}

/**
 * 少数の排他的な選択肢 (日/週/月、全量/1人前 など) の切り替え。赤は使わない。
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  label,
  size = "sm",
}: SegmentedControlProps<T>) {
  return (
    <SegmentGroup.Root
      size={size}
      value={value}
      aria-label={label}
      onValueChange={(details) => {
        const next = items.find((item) => item.value === details.value);
        if (next) onChange(next.value);
      }}
    >
      <SegmentGroup.Indicator />
      {items.map((item) => (
        <SegmentGroup.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          aria-label={item.ariaLabel}
        >
          <SegmentGroup.ItemText>{item.label}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}
