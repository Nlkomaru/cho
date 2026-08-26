# ディレクトリ

- `app/src/routes/`: TanStack Router のページとサーバールート
- `app/src/components/`: 複数画面で再利用する共有 UI。各コンポーネントはこの直下の単一ディレクトリに配置します。例: `app/src/components/player-card/index.tsx`。用途別の中間ディレクトリは作りません。
- `app/src/components/ui/`: Chakra UI を使う共有プリミティブ。コンポーネントをこの直下へフラットに配置します。例: `app/src/components/ui/button.tsx`。
- `app/src/routes/**/-components/`: 1 ページだけで使う UI。対象ルートの近くに置きます。例: `app/src/routes/aaa/bbb/ccc/-components/record-card/index.tsx`。
- `app/src/`: 調理記録の業務型と処理を、利用箇所に近い責務単位で配置
- `storybook/src/`: `app/src/components/` の stories

共有コンポーネントに昇格するのは複数画面で再利用される場合だけです。空のレイヤー、不要な barrel file、用途が一つしかない抽象化は作りません。
