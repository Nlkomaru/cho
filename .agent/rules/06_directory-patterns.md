# ディレクトリ

- `app/src/routes/`: TanStack Router のページとサーバールート
- `app/src/components/`: 複数画面で再利用する共有 UI。Chakra UI v3 を基本にし、用途に沿って配置します。
- `app/src/routes/**/-components/`: 1 ページだけで使う UI。対象ルートの近くに置きます。例: `app/src/routes/aaa/bbb/ccc/-components/record-card/index.tsx`。
- `app/src/`: 調理記録の業務型と処理を、利用箇所に近い責務単位で配置
- `app/theme/`: Chakra system、primitive/semantic tokens、recipes、slot recipes
- `app/styled-system/`: Panda CSS が生成するコード。手編集しません。
- `storybook/src/`: アプリ UI の Storybook stories
- `app/dist/client/`: Workers Static Assets のビルド出力。Storybook は `app/dist/client/storybook/` に同梱

共有コンポーネントに昇格するのは複数画面で再利用される場合だけです。空のレイヤー、不要な barrel file、用途が一つしかない抽象化は作りません。
