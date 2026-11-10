# デプロイと運用

アプリと Storybook は単一の `cho` Worker で配信します。`pnpm build` は Storybook を先にビルドし、アプリのクライアント出力 `app/dist/client/storybook/` に同梱して Worker Static Assets から `/storybook/` で配信します。

- App: `https://cho.nikomaru.dev/`
- Storybook: `https://cho.nikomaru.dev/storybook/`

## Cloudflare Workers 構成

設定は `app/wrangler.jsonc` にあり、以下のバインディングを使用します。

- Static Assets (`ASSETS`): クライアントビルドおよび `/storybook/`
- D1 (`DB`): アプリケーションデータベース (`cho`)
- R2 (`IMAGES_BUCKET`): 画像ストレージ (`cho-images`)

`<D1_DATABASE_ID>` はデプロイ環境で `CLOUDFLARE_DATABASE_ID` から解決し、実 ID はリポジトリに保存しません。

## 環境変数と GitHub Secrets

`main` への push と手動実行は `.github/workflows/deploy.yml`、Pull Request のプレビューは `.github/workflows/preview.yml` が担当します。GitHub Actions repository secrets に次を設定してください。

- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`
- アプリの暗号化: `SETTINGS_ENCRYPTION_KEY`
- Cloudflare Access Service Token（任意）: `CLOUDFLARE_ACCESS_CLIENT_ID`, `CLOUDFLARE_ACCESS_CLIENT_SECRET`（Inventia API が Access で保護されている場合のみ）

### `SETTINGS_ENCRYPTION_KEY` の管理

`SETTINGS_ENCRYPTION_KEY` は 32 バイトの暗号化キーを標準 Base64 で表した値です。

- 既存の暗号化データがある場合は、そのデータを暗号化した元のキーを GitHub Secrets に登録して維持してください。
- 既存データの有無や元のキーが不明な場合、新しいランダムキーで置き換えないでください。新しいキーの生成は、新規 DB または既存データの扱いを決定した運用担当者の明示的な判断に限ります。
- キーの値は表示・コミットしません。
- Production workflow は Worker のデプロイ後に `SETTINGS_ENCRYPTION_KEY` を stdin 経由でアップロードします。未設定の場合はアップロードを省略し、既存の Worker secret を保持します。
- 未設定でもデプロイと PR チェックは成功しますが、integration settings の認証情報保存・利用、AI 連携、署名付き画像 URL は利用できません。

## CI/CD と PR プレビュー

- **Production デプロイ (`deploy.yml`)**: デプロイ前に `wrangler d1 migrations apply DB --remote` を実行し、`INVENTIA_STOCK_WRITES_ENABLED:true` を付与してデプロイします。
- **PR チェック**: 一時 UUID を設定したローカル Wrangler SQLite DB に `--local` で migrations を適用し、production DB には接続しません。
- **App Preview (`preview.yml`)**:
  - `workers.dev` の alias URL（`pr<PR_NUMBER>-cho.nikomaru.workers.dev` と `<8-char-SHA>-cho.nikomaru.workers.dev`）を発行します。Cloudflare Access で保護されるため閲覧にはサインインが必要です。
  - **Production D1 (`DB`) に直接接続**します。`POST/PATCH/DELETE /api/meals`、`POST/PATCH/DELETE /api/dishes`、`POST/PATCH /api/ingredients`、`PUT /api/settings/integrations` などは本番データを書き換えるため、信頼できる利用者に限って共有し、データの変更・削除に注意してください。
  - Production R2 (`IMAGES_BUCKET`) は preview Worker config から除外するため、画像ストレージは利用できません。
  - `INVENTIA_STOCK_WRITES_ENABLED` を `"false"` に設定し、Inventia への在庫消費書き込みを無効化します。
  - `MCP_MANAGEMENT_ENABLED` を `"false"` に設定し、MCP トークン管理・利用状況 API を無効化します。
  - Preview workflow は remote migration を実行しません。マイグレーション未適用のテーブル変更がある PR では preview が停止する場合があります。

## D1 データベースの初期化・再構築

### ローカル D1 のリセット

ローカルの Wrangler D1 を初期状態から作り直す場合は、local state を削除してから migrations を適用します（`pnpm smoke:worker` は毎回一時 DB を使うため不要です）。

```bash
rm -rf app/.wrangler/state
pnpm --dir app exec wrangler d1 migrations apply DB --local
```

### Production D1 のリセット（手動ワークフロー）

`.github/workflows/reset-database.yml` の手動実行により、アプリテーブル（`meal_log_items`, `meal_logs`, `dish_ingredients`, `dishes`, `media_images`, `app_settings`, `ingredients`, `d1_migrations`）を FK 順に削除して `app/migrations/` から再適用できます。

> [!CAUTION]
> 実行すると Production（および共有している Preview）のアプリケーションデータはすべて失われます。

```bash
gh workflow run reset-database.yml --ref main -f confirmation=reset-cho-database
gh run list --workflow reset-database.yml --limit 1
```

`confirmation` が `reset-cho-database` と完全一致しない場合は失敗します。
