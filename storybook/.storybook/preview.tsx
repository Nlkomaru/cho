import { ChakraProvider } from "@chakra-ui/react";
import type { Preview } from "@storybook/react-vite";

import "../../app/src/styles.css";
import { system } from "../../app/theme";
import { withRouter } from "./with-router";

const preview: Preview = {
  decorators: [
    withRouter,
    (Story) => (
      <ChakraProvider value={system}>
        <Story />
      </ChakraProvider>
    ),
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    layout: "padded",
    viewport: {
      options: {
        mobile: {
          name: "モバイル 390",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        desktop: {
          name: "デスクトップ 1440",
          styles: { width: "1440px", height: "900px" },
          type: "desktop",
        },
      },
    },
    options: {
      storySort: {
        order: ["Foundations", "Layout", "Components", "Food", "*"],
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
