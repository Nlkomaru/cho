# Cho

料理やお菓子作りの記録を管理するアプリです。

- App: `https://cho.nikomaru.dev/`
- Storybook: `https://cho.nikomaru.dev/storybook/`

## 構成

- `app/`: TanStack Start / Router、React、Chakra UI v3、Panda CSS を使った Cloudflare Workers アプリ
- `storybook/`: アプリ UI のカタログ（ビルド時に `app/dist/client/storybook/` へ同梱）
- `docs/`: デプロイ・運用、外部連携、MCP サーバーのドキュメント

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

## 確認・ビルド・デプロイ

```bash
pnpm check          # 型チェック・リント・フォーマット確認
pnpm test           # テスト実行
pnpm build          # Storybook とアプリをビルド
pnpm smoke:worker   # ローカル D1 を使った Worker スモークテスト
pnpm cf-typegen     # Cloudflare Worker 型定義の生成
pnpm deploy         # ビルドして Cloudflare Workers へデプロイ
```

## ドキュメント

- [デプロイと運用](docs/deployment.md): Cloudflare Workers 構成、環境変数・シークレット、CI/CD、PR プレビュー、D1 データベース運用
- [Inventia 連携](docs/inventia.md): API トークン設定、在庫消費・価格参照の仕様
- [MCP サーバー](docs/mcp.md): エンドポイント仕様、Cloudflare Access 設定、クライアントキー管理・利用状況集計
