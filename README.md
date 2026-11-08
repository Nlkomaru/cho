# Cho

料理やお菓子作りの記録を管理するアプリです。

## 構成

- `app/`: TanStack Start / Router、React、Chakra UI v3、Panda CSS を使った Cloudflare Workers アプリ
- `storybook/`: アプリ UI のカタログ。Storybook の静的出力を `app/dist/client/storybook/` に同梱
- `spec/`: 技術・デザイン・機能仕様

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

## 確認とビルド

ルートの Vite+ コマンドでチェックとテストを実行します。

```bash
pnpm check
pnpm test
```

```bash
pnpm build
pnpm run build:storybook
```

`pnpm build` は Storybook を先にビルドし、続けてアプリをビルドします。アプリのクライアント出力 `app/dist/client/storybook/` に Storybook を同梱し、Worker Static Assets から `/storybook/` で配信します。

ビルド後、Worker と画面/API をローカルでスモーク確認します。`pnpm smoke:worker` は一時設定とローカル D1 のみを使い、Cloudflare へ接続しません。

```bash
pnpm smoke:worker
```

## Cloudflare Workers

アプリと Storybook は一つの `cho` Worker で配信します。

- App: `https://cho.nikomaru.dev/`
- Storybook: `https://cho.nikomaru.dev/storybook/`

Worker 型生成とデプロイはルートから実行します。`pnpm deploy` は両方をビルドしてから、`app/` の Worker だけをデプロイします。

```bash
pnpm cf-typegen
pnpm deploy
```

Cloudflare 設定は `app/wrangler.jsonc` にあり、Static Assets (`ASSETS`)、D1 (`DB`)、R2 (`IMAGES_BUCKET`) を使用します。`<D1_DATABASE_ID>` はデプロイ環境で `CLOUDFLARE_DATABASE_ID` から解決し、実 ID をリポジトリに保存しません。Production workflow は deploy 前に `wrangler d1 migrations apply DB --remote` を実行します。PR Check は一時 UUID を設定したローカル Wrangler SQLite DB に `--local` で migrations を適用し、production DB には接続しません。

`main` への push と手動実行は `.github/workflows/deploy.yml`、Pull Request のプレビューは `.github/workflows/preview.yml` が担当します。GitHub Actions repository secrets に次を設定してください:

- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`
- R2 preview QR artifacts only: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_S3_ENDPOINT`
- アプリの暗号化: `SETTINGS_ENCRYPTION_KEY`

`SETTINGS_ENCRYPTION_KEY` は32バイトの暗号化キーを標準 Base64 で表した値です。ローカル端末で生成して GitHub Secrets に直接登録します（値は表示・コミットされません）:

```bash
openssl rand -base64 32 | gh secret set SETTINGS_ENCRYPTION_KEY
```

未設定でもデプロイと PR チェックは成功しますが、integration settings の認証情報保存・利用、AI 連携、署名付き画像 URL は利用できません。GitHub Actions は未設定時に警告します。PR プレビューにこの secret は渡しません。

Storybook は App のクライアント静的アセット `app/dist/client/storybook/` に同梱されます。PR preview では同じ Worker の `/storybook/` で配信します。App preview は workers.dev の alias URL（Cloudflare Access で保護されるため閲覧にはサインインが必要）で production D1 (`DB`) に直接接続します。D1 の API は認証なしで、`POST/PATCH/DELETE /api/meals`、`POST/PATCH/DELETE /api/dishes`、`POST/PATCH /api/ingredients` や `PUT /api/settings/integrations` などの production データを書き換えられます。production R2 (`IMAGES_BUCKET`) と Inventia (`INVENTIA_BASE_URL`) は App preview Worker config から除き、画像ストレージおよび Inventia 連携・在庫操作は利用できません。`SETTINGS_ENCRYPTION_KEY` やアプリ資格情報も preview に渡しません。信頼できる利用者に限って共有し、production D1 の変更・削除に注意してください。PR comment は `preview-cho.nikomaru.workers.dev`、`pr<PR_NUMBER>-cho.nikomaru.workers.dev`、`<8-char-SHA>-cho.nikomaru.workers.dev` の3つの同一ビルド用 alias と、それぞれの `/storybook/` URL を掲載します。URL は comment 作成時に実際に到達できたものだけを載せ、到達できなかった target は `Not available` と表示します。QR はまず R2 に upload した artifact を `PREVIEW_BASE_URL`（repository variable で上書き可能、既定は `https://ci.nikomaru.dev/cho`）から認証なしで取得できた場合にその URL を掲載します。取得できない場合は、対象 URL を query parameter として渡す公開 QR rendering service（`quickchart.io`、失敗時は `api.qrserver.com`）の画像 URL に fallback するため、private bucket を公開する必要はありません。どちらも失敗した場合のみ `—` にして warning を出します。R2 credentials は QR 画像 artifact のみに使い、Storybook はアップロードしません。`workers_dev` と `preview_urls` は preview 用の生成 config でのみ `true` にし、production `app/wrangler.jsonc` の `false` defaults は維持します。

## Theme and styling

テーマは `app/theme/` にあり、Light mode、Poppins / Noto Sans JP / JetBrains Mono と白・黒・グレー・赤の Chakra tokens を定義します。Panda CSS 設定は `app/panda.config.ts`、Vite+ 設定は `app/vite.config.ts` にあります。
