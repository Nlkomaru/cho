import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import pandacss from "@pandacss/dev/postcss";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { defineConfig, type Plugin } from "vite-plus";
import viteTsConfigPaths from "vite-tsconfig-paths";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const storybookDir = path.resolve(__dirname, "../storybook/storybook-static");

const bundleStorybook = (): Plugin => ({
  name: "cho:bundle-storybook",
  apply: "build",
  applyToEnvironment: (environment) => environment.name === "client",
  writeBundle() {
    if (!fs.existsSync(storybookDir)) {
      const message = `${storybookDir} not found. Run pnpm run build:storybook first.`;
      if (process.env.CI) this.error(message);
      this.warn(message);
      return;
    }
    const outDir = path.resolve(
      this.environment.config.root,
      this.environment.config.build.outDir,
      "storybook",
    );
    fs.cpSync(storybookDir, outDir, {
      recursive: true,
      filter: (src) => path.basename(src) !== "_headers",
    });
  },
});

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: [".trycloudflare.com", ".nikomaru.dev"],
  },
  css: {
    postcss: {
      plugins: [pandacss, autoprefixer],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "#": fileURLToPath(new URL("./src", import.meta.url)),
      "styled-system": fileURLToPath(new URL("./styled-system", import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    ...(process.env.VITEST ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact(),
    bundleStorybook(),
  ],
  lint: {
    ignorePatterns: [
      "dist/**",
      "styled-system/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
      "storybook-static/**",
    ],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      "styled-system/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
      "pnpm-lock.yaml",
    ],
    useTabs: true,
    tabWidth: 4,
    singleQuote: false,
    semi: true,
  },
  test: { include: ["src/**/*.test.{ts,tsx}"], environment: "node" },
  staged: { "*.{js,jsx,ts,tsx,json,css}": "vp check --fix" },
});
