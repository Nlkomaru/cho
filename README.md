# Cho

料理やお菓子作りの記録を管理するアプリです。

## 構成

- `app/`: TanStack Start、React、Tailwind CSS、Cloudflare Workers で動くアプリ本体
- `storybook/`: `app/src/components/` の共有 UI を確認する Storybook

## 開発

依存関係をインストールし、アプリ（port 3000）と Storybook（port 6006）を起動します。

```bash
pnpm install
pnpm dev
```

個別に起動する場合:

```bash
pnpm --filter ./app dev
pnpm --filter ./storybook dev
```

## 確認

```bash
pnpm check
pnpm build
```

`pnpm build` はアプリと Storybook の両方をビルドし、Storybook を
`app/dist/client/storybook/` へ同梱します。

## Cloudflare Workers

アプリと Storybook は一つの `cho` Worker で配信します。

- App: `https://cho.nikomaru.dev/`
- Storybook: `https://cho.nikomaru.dev/storybook/`

Worker 型生成とデプロイはルートから実行します。`pnpm deploy` は両方をビルドしてから、
`app/` の Worker だけをデプロイします。

```bash
pnpm cf-typegen
pnpm deploy
```

`main` への push と手動実行は `.github/workflows/deploy.yml`、Pull Request の
プレビューは `.github/workflows/preview.yml` が担当します。Actions では
`BWS_ACCESS_TOKEN`、`AWS_REGION`、`S3_URL`、`BUCKET_NAME` をリポジトリ secrets に設定します。
