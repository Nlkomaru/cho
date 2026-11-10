# Inventia 連携

Cho は Inventia の API（`inv_` API トークン認証）と連携し、品目検索・在庫参照・価格取得・在庫消費を行います。連携のために Discord ログインや Cho 自体の Cloudflare Access 認証を変更する必要はありません。

## セットアップ手順

1. [Inventia の API トークン設定](https://inventia.nikomaru.dev/settings/tokens)を開き、Cho 用のトークンを発行します（トークン本体は発行時に一度だけ表示されます）。
2. Cho の設定画面（`/_app/settings`）でトークンを保存します。
3. 在庫消費を利用する場合は、Inventia の連携先マスタで取得した **Provider ID** も設定します。品目検索・在庫参照・価格取得には Provider ID は不要です。

## 認証情報の暗号化と状態確認

トークンの保存・復号には Worker の `SETTINGS_ENCRYPTION_KEY`（32 バイトの標準 Base64 文字列）が必要です。既存の暗号化データがある環境では同じキーを維持してください。

`GET /api/settings/integrations` は暗号化キーがなくても公開設定と状態を返します。

- `configured`: 暗号化済み認証情報が D1 に保存されていることを表します。
- `usable` / `capabilities.readItems`: Worker 内で復号と設定検証ができることを表します（Inventia への実通信成功を保証するものではありません）。
- `issue`: 利用できない場合の理由を返します。D1 のテーブル不足などの保存先エラーは、未設定状態に置き換えずエラーとして返します。

## 材料の単価

材料の単価（`latestUnitPriceYen`、栄養価の基準量あたりの円）は、Inventia と連携している材料では Inventia の価格を使います。連携していない材料は、材料の編集画面の「単価（手入力）」、`POST/PATCH /api/ingredients`、MCP の `create_ingredient` / `update_ingredient` で手入力できます。

- 連携中の材料に送った手入力の単価は無視します。
- 手入力の単価がある材料を Inventia と連携し、Inventia に価格が無い場合は手入力の単価を残します。
- 連携を解除すると単価は空になります。

## 在庫消費の保護（`INVENTIA_STOCK_WRITES_ENABLED`）

`INVENTIA_STOCK_WRITES_ENABLED` は `app/wrangler.jsonc` には定義せず、未設定時はアプリ側で在庫消費を拒否します。

- **Production**: デプロイステップのみが `wrangler deploy --var INVENTIA_STOCK_WRITES_ENABLED:true` で有効化し、有効な Provider ID がある場合に在庫消費を許可します。手動の `wrangler deploy` でも var を渡さない限り在庫消費は無効です。
- **PR Preview**: 生成 config で明示的に `"false"` を設定し、Inventia の在庫変更を防止します（品目・在庫・価格の読み取り参照は `INVENTIA_BASE_URL`、保存済みトークン、`SETTINGS_ENCRYPTION_KEY` が揃っていれば利用可能です）。

## Cloudflare Access 保護環境での追加設定

Inventia API が Cloudflare Access の保護対象である環境では、Worker に許可された `CLOUDFLARE_ACCESS_CLIENT_ID` と `CLOUDFLARE_ACCESS_CLIENT_SECRET` の設定も必要です（これらは Access 通過用であり、`inv_` API トークンの代わりにはなりません）。
