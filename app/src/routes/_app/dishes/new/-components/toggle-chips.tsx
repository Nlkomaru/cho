import { chakra, Flex, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";

export interface ToggleChipOption {
  value: string;
  label: string;
}

export interface ToggleChipsProps {
  /** グループの読み上げ名。 */
  label: string;
  options: readonly ToggleChipOption[];
  value: readonly string[];
  onChange(value: string[]): void;
  /** 選べるものが無いときの 1 行。 */
  emptyText?: string;
  id?: string;
}

/**
 * 複数選択のチップ。依存する手順や投入するグループのように、少数から選ぶときに使う。
 */
export function ToggleChips({ label, options, value, onChange, emptyText, id }: ToggleChipsProps) {
  if (!options.length)
    return emptyText ? (
      <Text id={id} textStyle="body.sm" color="fg.subtle">
        {emptyText}
      </Text>
    ) : null;
  const selected = new Set(value);
  return (
    <Flex role="group" aria-label={label} id={id} wrap="wrap" gap="2">
      {options.map((option) => {
        const on = selected.has(option.value);
        return (
          <chakra.button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? value.filter((item) => item !== option.value) : [...value, option.value],
              )
            }
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            h="8"
            px="3"
            maxW="full"
            borderRadius="l2"
            borderWidth="1px"
            borderColor={on ? "navy.900" : "border.emphasized"}
            bg={on ? "navy.900" : "bg.panel"}
            color={on ? "white" : "fg.strong"}
            fontSize="14px"
            fontWeight="500"
            cursor="pointer"
            transition="colors 120ms"
            _hover={{ borderColor: on ? "navy.700" : "navy.400", bg: on ? "navy.700" : "navy.50" }}
            focusVisibleRing="outside"
          >
            {on ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
            <chakra.span truncate>{option.label}</chakra.span>
          </chakra.button>
        );
      })}
    </Flex>
  );
}
