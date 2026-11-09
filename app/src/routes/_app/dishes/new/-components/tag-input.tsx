import { Badge, chakra, Flex, Input } from "@chakra-ui/react";
import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

export interface TagInputProps {
  value: readonly string[];
  onChange(value: string[]): void;
  /** 入力欄の読み上げ名 (Field の中ではラベルが付くので不要)。 */
  "aria-label"?: string;
  id?: string;
  placeholder?: string;
  maxLength?: number;
}

/**
 * 短い語を並べる入力。Enter か読点・カンマで確定し、バッジの × で外す。
 */
export function TagInput({
  value,
  onChange,
  id,
  placeholder,
  maxLength = 64,
  ...aria
}: TagInputProps) {
  const [text, setText] = useState("");

  const commit = (raw: string) => {
    const tags = raw
      .split(/[,、，]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag && !value.includes(tag));
    if (tags.length) onChange([...value, ...tags]);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <Flex
      w="full"
      wrap="wrap"
      align="center"
      gap="1.5"
      minH="10"
      px="2"
      py="1.5"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="l2"
      bg="bg.panel"
      _hover={{ borderColor: "navy.400" }}
      _focusWithin={{ borderColor: "navy.900", boxShadow: "0 0 0 1px {colors.navy.900}" }}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="outline" gap="1" pe="1">
          {tag}
          <chakra.button
            type="button"
            aria-label={`${tag} を外す`}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            display="inline-flex"
            borderRadius="full"
            color="fg.muted"
            cursor="pointer"
            _hover={{ color: "fg.strong", bg: "navy.100" }}
            focusVisibleRing="outside"
          >
            <X size={12} strokeWidth={2} aria-hidden="true" />
          </chakra.button>
        </Badge>
      ))}
      <Input
        id={id}
        variant="flushed"
        flex="1"
        minW="8rem"
        h="7"
        px="1"
        border="none"
        boxShadow="none"
        _focusVisible={{ boxShadow: "none", outline: "none" }}
        maxLength={maxLength}
        value={text}
        placeholder={value.length ? undefined : placeholder}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (/[,、，]/.test(next)) commit(next);
          else setText(next);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
        {...aria}
      />
    </Flex>
  );
}
