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

### D1 スキーマの現状と移行

production D1 (`cho`) は廃止したレシピ/調理記録スキーマから引き継いでおり、2026-11-08 時点の読み取り専用診断で次を確認しています。

- 存在する: `ingredients`（旧スキーマ。`owner_id`、`grams_per_milliliter`、`inventory_item_id`、`note` を持ち、`user` を参照）、`user`、`session`、`account`、`verification`、`recipes`、`recipe_*`、`cook_*`、`ingredient_conversions`、`d1_migrations`
- 存在しない: `media_images`、`dishes`、`dish_ingredients`、`meal_logs`、`meal_log_items`、`app_settings`

このため `app/migrations/` は 2 段構えです。

- `0000_initial.sql`: 旧 `ingredients` の実形状（production と同一）を表すベースライン。新規 DB ではこれを作成し、production では形状が一致することを確認して `d1_migrations` に適用済みとして記録するだけで、実行しません。
- `0001_reconcile_legacy_schema.sql`: 旧 `ingredients` を `ingredients_legacy_v0` にリネームして行を保持し、`app/src/db/schema.ts` の形で `ingredients` を作り直して旧行を `INSERT ... SELECT` で移行します（密度がある行は `volume`/`mL`/100、それ以外は `count`/`個`/1、栄養価は 0 で `memo` に確認が必要な旨を記録、`inventory_item_id` は `inventia_item_id` へ）。続けて不足している 6 テーブルを `0000_initial.sql` と同じ DDL で作成します。

production への適用は明示的な運用承認が必要です。承認後に、実 ID を一時 config にだけ展開して次を実行します（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` は環境変数で渡し、値を表示しない）。

```bash
cfg=".wrangler-operator.$$.jsonc"
sed "s/<D1_DATABASE_ID>/${CLOUDFLARE_DATABASE_ID}/" app/wrangler.jsonc >"app/$cfg"

# 1) 形状を読み取り専用で確認する（sqlite_master と PRAGMA table_info(ingredients)）
pnpm --dir app exec wrangler d1 execute DB --remote --config "$cfg" --json \
  --command "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY type, name;"

# 2) ベースラインを適用済みとして記録する（production への書き込み。承認後にのみ実行）
pnpm --dir app exec wrangler d1 execute DB --remote --config "$cfg" \
  --command "INSERT INTO d1_migrations (name) VALUES ('0000_initial.sql');"

# 3) 0001 を適用し、Wrangler が 0001 を記録する
pnpm --dir app exec wrangler d1 migrations apply DB --remote --config "$cfg"

rm "app/$cfg"
```

3 が失敗した場合は `DELETE FROM d1_migrations WHERE name = '0000_initial.sql';` で 2 の記録を戻し、読み取り専用診断からやり直します。2 と 3 の完了までは `main` の deploy は 0000 の `CREATE TABLE` で停止し、意図せず古い形のまま進むことはありません。適用後は `ingredients_legacy_v0` に旧行がそのまま残るため、旧 `note` や密度は参照できます。

ローカルの Wrangler D1 に旧 `0000_initial.sql`（7 テーブル版）を適用済みの場合は、`0001` と形状が合わないため local state を削除してから `pnpm dev` を再実行してください。`pnpm smoke:worker` は毎回一時 DB を使うため影響を受けません。

プレビューは production D1 を共有するため、上の移行が終わるまで `/api/settings/integrations` などの D1 依存 API は 500 になります。preview workflow は移行前に読み取り専用チェックで停止します。

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

## Theme and styling

テーマは `app/theme/` にあり、Light mode、Poppins / Noto Sans JP / JetBrains Mono と白・黒・グレー・赤の Chakra tokens を定義します。Panda CSS 設定は `app/panda.config.ts`、Vite+ 設定は `app/vite.config.ts` にあります。
