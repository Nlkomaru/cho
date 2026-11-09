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

Production workflow の Worker deploy と secret upload は lockfile で固定した Wrangler CLI を使い、Worker のデプロイ後に `SETTINGS_ENCRYPTION_KEY` を stdin 経由でアップロードします。この secret が未設定の場合はアップロードを省略し、既存の Worker secret を保持します。

### D1 データベースの初期化

このアプリはまだ本番運用しておらず、production D1 (`cho`) のアプリケーションデータは破棄可能と判断しました。production D1 は廃止したレシピ/調理記録スキーマを引き継ぎ、`ingredients` も旧形状だったため、データ移行は行わずにアプリテーブルを削除して `app/migrations/0000_initial.sql` から作り直します。2026-11-08 にこのリセットを実行し、production のアプリテーブルは空です（[run 42484824836](https://github.com/Nlkomaru/cho/actions/runs/42484824836)、commit `4783f05`）。旧スキーマの `user` / `recipes` などの残骸テーブルは削除対象外で残りますが、アプリは参照しません。

リセット前の production は、読み取り専用診断（[run 42481922172](https://github.com/Nlkomaru/cho/actions/runs/42481922172)、commit `3e887ea`）で次の状態でした。

- `ingredients` は旧形状: `id` (TEXT, PK), `owner_id` (TEXT, NOT NULL), `name` (TEXT, NOT NULL), `grams_per_milliliter` (REAL), `inventory_item_id` (TEXT), `note` (TEXT), `created_at` / `updated_at` (TEXT, NOT NULL)。FK は `owner_id → user(id)`、index は `ingredients_owner_idx` と `ingredients_owner_name_unique`。
- `media_images`, `dishes`, `dish_ingredients`, `meal_logs`, `meal_log_items`, `app_settings` は存在しない。
- 旧スキーマの `user`, `session`, `account`, `verification`, `recipes`, `recipe_categories`, `recipe_images`, `recipe_ingredients`, `recipe_steps`, `recipe_references`, `cook_records`, `cook_images`, `ingredient_conversions`, `d1_migrations` が存在。

リセット後のテーブル一覧（run の最終出力）: `_cf_KV`, `account`, `app_settings`, `cook_images`, `cook_records`, `d1_migrations`, `dish_ingredients`, `dishes`, `ingredient_conversions`, `ingredients`, `meal_log_items`, `meal_logs`, `media_images`, `recipe_categories`, `recipe_images`, `recipe_ingredients`, `recipe_references`, `recipe_steps`, `recipes`, `session`, `user`, `verification`。

リセットは `.github/workflows/reset-database.yml` の手動実行だけで行います。

- 削除するテーブル（FK 順）: `meal_log_items`, `meal_logs`, `dish_ingredients`, `dishes`, `media_images`, `app_settings`, `ingredients`, `d1_migrations`。これ以外のテーブルは触りません。
- 続けて `wrangler d1 migrations apply DB --remote` で `app/migrations/0000_initial.sql` を再適用します。
- 最後に `sqlite_master` のテーブル一覧を出力します。

再実行する場合（production のアプリデータは毎回失われます）:

```bash
gh workflow run reset-database.yml --ref main -f confirmation=reset-cho-database
gh run list --workflow reset-database.yml --limit 1
```

`confirmation` が `reset-cho-database` と完全一致しない場合は失敗します。`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` は repository secrets の値を使い、workflow は値を出力しません。

ローカルの Wrangler D1 も同じ形にしたい場合は、local state を削除してから migrations を適用します。

```bash
rm -rf app/.wrangler/state
pnpm --dir app exec wrangler d1 migrations apply DB --local
```

`pnpm smoke:worker` は毎回一時 DB を使うため、この操作は不要です。

preview は production D1 を共有します。リセット後は production のアプリテーブルが空で、preview も同じ空のテーブルを参照します。アプリデータの復元手順はなく、必要なら移行前のバックアップからのみ戻せます。

`main` への push と手動実行は `.github/workflows/deploy.yml`、Pull Request のプレビューは `.github/workflows/preview.yml` が担当します。GitHub Actions repository secrets に次を設定してください:

- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`
- R2 preview QR artifacts only: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_S3_ENDPOINT`
- アプリの暗号化: `SETTINGS_ENCRYPTION_KEY`

`SETTINGS_ENCRYPTION_KEY` は32バイトの暗号化キーを標準 Base64 で表した値です。既存の暗号化データがある場合は、そのデータを暗号化した元のキーを GitHub Secrets に登録して維持してください。既存データの有無や元のキーが不明な場合、新しいランダムキーで置き換えないでください。新しいキーの生成は、新規 DB または既存データの扱いを決定した運用担当者の明示的な判断に限ります。キーの値は表示・コミットしません。

未設定でもデプロイと PR チェックは成功しますが、integration settings の認証情報保存・利用、AI 連携、署名付き画像 URL は利用できません。GitHub Actions は未設定時に警告します。PR プレビューには、この secret と任意の `CLOUDFLARE_ACCESS_CLIENT_ID` / `CLOUDFLARE_ACCESS_CLIENT_SECRET` が設定されている場合のみ preview version に渡します。Access service token は Inventia API が Access で保護されている場合にだけ必要です。現在の `/api/items` の `401 API_TOKEN_REQUIRED` は Inventia API トークンの要求を示し、Access service token が必須である証拠ではありません。

Storybook は App のクライアント静的アセット `app/dist/client/storybook/` に同梱されます。PR preview では同じ Worker の `/storybook/` で配信します。App preview は workers.dev の alias URL（Cloudflare Access で保護されるため閲覧にはサインインが必要）で production D1 (`DB`) に直接接続します。D1 の API は認証なしで、`POST/PATCH/DELETE /api/meals`、`POST/PATCH/DELETE /api/dishes`、`POST/PATCH /api/ingredients` や `PUT /api/settings/integrations` などの production データを書き換えられます。production R2 (`IMAGES_BUCKET`) は App preview Worker config から除くため画像ストレージは利用できません。Inventia (`INVENTIA_BASE_URL`) は読み取り参照用に残し、`INVENTIA_STOCK_WRITES_ENABLED` を `false` にして在庫の外部書き込みを無効化します。`SETTINGS_ENCRYPTION_KEY`、`CLOUDFLARE_ACCESS_CLIENT_ID`、`CLOUDFLARE_ACCESS_CLIENT_SECRET` は repository secret が設定されている場合のみ preview version に追加し、未設定なら既存の Worker secret をそのまま継承します（暗号化キーがない既存の資格情報は復号できません）。信頼できる利用者に限って共有し、production D1 の変更・削除に注意してください。PR comment は `preview-cho.nikomaru.workers.dev`、`pr<PR_NUMBER>-cho.nikomaru.workers.dev`、`<8-char-SHA>-cho.nikomaru.workers.dev` の3つの同一ビルド用 alias と、それぞれの `/storybook/` URL を掲載します。URL は comment 作成時に実際に到達できたものだけを載せ、到達できなかった target は `Not available` と表示します。QR はまず R2 に upload した artifact を `PREVIEW_BASE_URL`（repository variable で上書き可能、既定は `https://ci.nikomaru.dev/cho`）から認証なしで取得できた場合にその URL を掲載します。取得できない場合は、対象 URL を query parameter として渡す公開 QR rendering service（`quickchart.io`、失敗時は `api.qrserver.com`）の画像 URL に fallback するため、private bucket を公開する必要はありません。どちらも失敗した場合のみ `—` にして warning を出します。R2 credentials は QR 画像 artifact のみに使い、Storybook はアップロードしません。`workers_dev` と `preview_urls` は preview 用の生成 config でのみ `true` にし、production `app/wrangler.jsonc` の `false` defaults は維持します。

## Inventia 連携

Cho の Cloudflare Access 認証は変更しません。Inventia 連携のための Discord ログインは不要です。Inventia の API は `inv_` API トークンで認証します。

1. [Inventia の API トークン設定](https://inventia.nikomaru.dev/settings/tokens)を開き、Cho 用のトークンを発行します。トークン本体は発行時に一度だけ表示されます。
2. Cho の設定画面でトークンを保存します。在庫消費を利用する場合は、Inventia の連携先マスタで取得した Provider ID も設定します。品目検索・在庫参照・価格取得には Provider ID は不要です。

トークンの保存・復号には、Worker の `SETTINGS_ENCRYPTION_KEY` が必要です。32 バイトを標準 Base64 で表した値を設定し、既存の暗号化データと同じキーを維持してください。既存の暗号化データがある環境で、新しいランダムキーに置き換えないでください。

`GET /api/settings/integrations` は暗号化キーがなくても公開設定と状態を返します。`configured` は暗号化済み認証情報が D1 に保存されていることを表します。`usable` と `capabilities.readItems` は、Worker 内で復号と設定検証ができることを表します。これらは Inventia への実通信成功を保証しません。利用できない理由は `issue` に返します。D1 のテーブル不足などの保存先エラーは、未設定状態に置き換えずエラーとして返します。

`INVENTIA_STOCK_WRITES_ENABLED` は `app/wrangler.jsonc` に置きません。未設定時はアプリ側で在庫消費を拒否します。production の deploy step だけが `wrangler deploy --var INVENTIA_STOCK_WRITES_ENABLED:true` で有効化し、有効な Provider ID がある場合に在庫消費を許可します。手動の `wrangler deploy` でも var を渡さない限り在庫消費は無効のままです。PR preview は生成 config で同じ値を明示的に `"false"` にします。CI の config 書き換えがスキップされた場合も、preview にはこの var が無いため stock writes は既定で無効のままです。品目参照には `INVENTIA_BASE_URL`、有効な保存済みトークン、対応する `SETTINGS_ENCRYPTION_KEY` が必要です。preview にこれらを渡さない場合、画面に設定不足を表示し、Inventia のデータは参照できません。preview の read-only 制限は Inventia の在庫変更に対する制限です。Cho の production D1 に対する既存の書き込み権限は変更しません。

Inventia API が Cloudflare Access の保護対象である環境では、許可された `CLOUDFLARE_ACCESS_CLIENT_ID` と `CLOUDFLARE_ACCESS_CLIENT_SECRET` も必要です。API トークンの代わりにはなりません。

## MCP サーバー

`POST /api/mcp` は、ステートレスな Streamable HTTP MCP エンドポイントです。`list_ingredients`、`create_ingredient`、`list_recipes`、`create_recipe`、`record_meal` を提供します。API トークンには、明示したツールだけを許可できます。食事の記録は Cho に保存し、Inventia の在庫は変更しません。

### MCP と Cloudflare Access

Cho は Inventia の設計に倣い、設定画面および管理 API（`/api/mcp/tokens`, `/api/mcp/usage`）をアプリ本体と同様に Cloudflare Access で保護します。帯域外の管理用 Bearer シークレット（`cho_mgr_...` / `MCP_MANAGEMENT_TOKEN_HASH`）は不要です。

Cloudflare Access のバイパス対象には、MCP ランタイムエンドポイントのみを設定してください。

- `/api/mcp`

`/api/mcp/tokens` や `/api/mcp/usage`、`/api/*` 全体をバイパスしてはいけません。キー管理 API や設定、AI、品目、料理、食事、画像、在庫など他の API はアプリ側の Bearer 認証を持たず、全体バイパスすると保護されなくなります。画面やキー管理 API は引き続き Cloudflare Access で保護します。

ブラウザーから `/api/mcp` を呼ぶ場合は `MCP_ALLOWED_ORIGINS` に Origin の完全一致リストを設定します。Origin がない MCP クライアントは許可し、Origin がある要求は許可リストにない場合に拒否します。

### MCP クライアントキー管理

Cho は `better-auth`（`@better-auth/api-key`）と D1（`mcp_api_tokens`）を使用して `cho_mcp_...` クライアントキーを生成・検証します（Inventia のトークン管理・利用状況ダッシュボードの設計に準拠）。

設定画面（`/_app/settings`）の「MCP クライアントキー」から、直接以下の操作を行えます。

- **キー発行**: キー名、許可ツール（`list_ingredients`, `create_ingredient`, `list_recipes`, `create_recipe`, `record_meal` から選択）、および任意の有効期限（7日、30日、90日、無期限）を指定して発行します。
- **ワンタイム表示と接続スニペット**: キー本体（`cho_mcp_...`）は発行時の一度のみ表示されます。画面上で即座にコピー可能な連携スニペットが提供されます:
  - `hermes mcp add cho <url> --headers "Authorization: Bearer <key>"`
  - MCP JSON 設定スニペット（VS Code / Claude Desktop 用）
  - `curl` テストコマンド
- **キー一覧と失効**: 発行済みキーのプレフィックス、許可ツール、作成日時、有効期限、失効状態、最終利用日時を確認でき、不要になったキーを即座に失効（Revoke）できます。
- **利用状況ダッシュボード**: 過去30日間の UTC 日別アクティビティチャート、ツール別合計呼び出し件数および最終利用日、キー別の呼び出し件数内訳を確認できます。

MCP クライアントは `Authorization: Bearer <クライアントキー>` を付けて `POST /api/mcp` を呼び出します。サーバーは許可されていないツールを一覧から隠し、そのツールへの呼び出しを拒否します。

### 使用状況の集計とプレビュー保護

`GET /api/mcp/usage` は、直近30日のアクティビティサマリー（`summary`）とトークン・ツールごとの集計（`usage`）を返します。Cho は登録済みツールの呼び出しを実行前にカウントします。入力検証や処理に失敗した呼び出しも含みます。件数を保存できない場合、ツールを実行しません。Cho は引数、応答、食事データ、エラー本文、トークン文字列を使用状況に保存しません。

PR preview は Production D1 を共有するため、Worker の設定で `MCP_MANAGEMENT_ENABLED="false"` に設定され、トークン管理・利用状況 API は D1 に触れる前に `503` で拒否されます。また、プレビューをアップロードする前に `mcp_api_tokens` と `mcp_tool_usage_daily` の列、制約、index を Production D1 に対して読み取り専用で確認し、不足または不一致なら停止します。Preview workflow は remote migration を実行しません。Production Deploy workflow が merge 後に migration を適用するため、テーブルがまだない PR preview は利用できません。トークンの発行や管理は Production 環境で行ってください。

Cho の MCP Bearer キーは独自の事前設定方式です。Cho は OAuth 認可サーバーを提供しないため、この MCP エンドポイントは OAuth との相互運用を主張しません。

Cho の MCP Bearer キーは独自の事前設定方式です。Cho は OAuth 認可サーバーを提供しないため、この MCP エンドポイントは OAuth との相互運用を主張しません。

## Theme and styling

テーマは `app/theme/` にあり、Light mode、Poppins / Noto Sans JP / JetBrains Mono と白・黒・グレー・赤の Chakra tokens を定義します。Panda CSS 設定は `app/panda.config.ts`、Vite+ 設定は `app/vite.config.ts` にあります。
