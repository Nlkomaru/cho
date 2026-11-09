import { Field, Portal, Select, createListCollection } from "@chakra-ui/react";
import { useMemo } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  /** ラベルを視覚的に隠す (ツールバーなど)。 */
  hideLabel?: boolean;
}

/**
 * ポップアップ型のセレクト。選択肢の見た目を揃えたいツールバー向け。
 * フォームの中では NativeSelect を優先する。
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "選択",
  size = "md",
  hideLabel,
}: SelectFieldProps) {
  const collection = useMemo(() => createListCollection({ items: [...options] }), [options]);

  return (
    <Field.Root minW="0">
      <Select.Root
        collection={collection}
        size={size}
        value={value ? [value] : []}
        onValueChange={(details) => onChange(details.value[0] ?? "")}
        positioning={{ sameWidth: true }}
      >
        <Select.HiddenSelect />
        <Select.Label srOnly={hideLabel}>{label}</Select.Label>
        <Select.Control>
          <Select.Trigger>
            <Select.ValueText placeholder={placeholder} />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content>
              {collection.items.map((item) => (
                <Select.Item item={item} key={item.value}>
                  {item.label}
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Field.Root>
  );
}
