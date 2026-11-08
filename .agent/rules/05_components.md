# コンポーネントについて

## コンポーネントの命名規則

- コンポーネントの命名規則は、kebab-caseを使用してください。(例: `app/src/components/player-card.tsx`)

## コンポーネントの設計パターン

- Compound Component パターンに従って設計してください。
  - 参考: [Compound Component パターン](https://www.patterns.dev/react/compound-component/)
- Panda CSSのtokenおよびsemantic tokenを活用して設計してください。
  - 参照先: `theme/`
  - テーマ状態は`next-themes`で管理してください。
  - Chakra UIのtheme tokenとrecipeを優先して利用してください。
  - ex ) `bg.canvas`
  - ex ) `fg`
  - ex ) `colorPalette.solid`
- Storybookを活用して、コンポーネントの動作確認およびドキュメント化を行ってください。
  - 参考: [Storybook公式ドキュメント](https://storybook.js.org/docs/react/get-started/introduction)

## コンポーネントのディレクトリ構成

- **全体で利用するコンポーネント（グローバルコンポーネント）**は、`src/components/`ディレクトリ配下に**フラットに**配置してください。
  - コンポーネント本体は `src/components/player-card.tsx` のように配置してください。
- **Chakra UIのラッパーコンポーネント**は、`src/components/ui/`ディレクトリ配下に**フラットに**配置してください。
- 共有recipe / slot recipeは`theme/recipes/`と`theme/slot-recipes/`に配置してください。
- **各ページごとに利用するコンポーネント（ページ固有のコンポーネント）**は、該当ページの近くに配置してください。
  - 配置場所: `src/routes/**/-components/`ディレクトリ配下に配置してください。
  - 例:
    - `src/routes/aaa/bbb/ccc/-components/record-card.tsx`
    - `src/routes/aaa/bbb/ccc/-components/record-card.stories.tsx`
  - グローバルで利用するもの以外は、必ず`/routes`にある各ページの近くに配置してください。
