import { NativeSelect as ChakraNativeSelect } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps {
  options: readonly NativeSelectOption[];
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * ネイティブ select。モバイルで OS のピッカーが使えるので、フォームではこちらを優先する。
 * Field の中に置くとラベルが自動で結び付く。
 */
export function NativeSelect({
  options,
  value,
  onChange,
  placeholder,
  size = "md",
  disabled,
  id,
  name,
  ...aria
}: NativeSelectProps) {
  return (
    <ChakraNativeSelect.Root size={size} disabled={disabled}>
      <ChakraNativeSelect.Field
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...aria}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </ChakraNativeSelect.Field>
      <ChakraNativeSelect.Indicator>
        <ChevronDown strokeWidth={1.75} />
      </ChakraNativeSelect.Indicator>
    </ChakraNativeSelect.Root>
  );
}
