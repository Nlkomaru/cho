import { Box, Input, chakra } from "@chakra-ui/react";
import { Search, X } from "lucide-react";
import { useId } from "react";

export interface SearchInputProps {
  value: string;
  onChange(value: string): void;
  /** 視覚的に隠したラベル。 */
  label: string;
  placeholder?: string;
  maxW?: string;
}

/**
 * 検索欄。箱を描かず下線だけの AISI 型。末尾に虫眼鏡、入力中はクリアボタン。
 */
export function SearchInput({ value, onChange, label, placeholder, maxW }: SearchInputProps) {
  const id = useId();

  return (
    <Box position="relative" w="full" maxW={maxW} role="search">
      <chakra.label htmlFor={id} srOnly>
        {label}
      </chakra.label>
      <Input
        id={id}
        type="search"
        variant="flushed"
        h="10"
        pe="9"
        fontSize="15px"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        css={{ "&::-webkit-search-cancel-button": { display: "none" } }}
      />
      <Box position="absolute" insetEnd="0" top="0" h="10" display="flex" alignItems="center">
        {value ? (
          <chakra.button
            type="button"
            aria-label="検索語を消去"
            onClick={() => onChange("")}
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxSize="7"
            borderRadius="full"
            color="fg.subtle"
            cursor="pointer"
            _hover={{ bg: "navy.100", color: "fg.strong" }}
            _focusVisible={{ outline: "2px solid {colors.navy.900}", outlineOffset: "2px" }}
          >
            <X size={16} strokeWidth={1.75} />
          </chakra.button>
        ) : (
          <Box color="fg.subtle" pe="1" aria-hidden="true">
            <Search size={16} strokeWidth={1.75} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
