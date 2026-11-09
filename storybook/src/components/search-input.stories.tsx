import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { SearchInput, type SearchInputProps } from "@/components/ui/search-input";

function Controlled(props: SearchInputProps) {
  const [value, setValue] = useState(props.value);
  return <SearchInput {...props} value={value} onChange={setValue} />;
}

const meta = {
  title: "Components/SearchInput",
  component: SearchInput,
  args: {
    label: "レシピを検索",
    placeholder: "料理名で検索",
    value: "",
    onChange: () => undefined,
    maxW: "sm",
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { value: "カレー" } };
