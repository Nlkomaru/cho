# MCP サーバー

`POST /api/mcp` はステートレスな Streamable HTTP MCP エンドポイントです。

## 提供ツール

API トークンごとに許可するツールを選択できます。サーバーは許可されていないツールを一覧から隠し、呼び出しを拒否します。

- **材料 (`ingredients`)**: `list_ingredients`, `get_ingredient`, `create_ingredient`, `update_ingredient`, `delete_ingredient`
- **Inventia 連携**: `search_inventia_items`, `link_inventia_item`, `get_ingredient_stock`
- **レシピ (`recipes`)**: `list_recipes`, `get_recipe`, `create_recipe`, `update_recipe`, `delete_recipe`, `calculate_purchase_list`
- **画像 (`images`)**: `upload_image`, `create_image_upload`, `set_recipe_images`
- **食事記録 (`meals`)**: `list_meals`, `get_meal`, `record_meal`, `update_meal`, `delete_meal`（食事の記録は Cho に保存し、Inventia の在庫は変更しません）

## Cloudflare Access 設定

設定画面および管理 API（`/api/mcp/tokens`, `/api/mcp/usage`）はアプリ本体と同様に Cloudflare Access で保護します。帯域外の管理用 Bearer シークレットは不要です。

Cloudflare Access のバイパス対象には、以下の MCP ランタイムエンドポイントのみを設定してください。

- `/api/mcp`
- `/api/mcp/uploads/*`（`create_image_upload` が発行する署名付き画像アップロード URL。署名と有効期限で認可するため MCP トークンは不要）

> [!WARNING]
>
> - `/api/mcp/uploads/*` をバイパスに含めないと、エージェントが `curl` 等で画像を PUT する際に Access のサインイン画面で失敗します。
> - `/api/mcp/tokens`、`/api/mcp/usage`、または `/api/*` 全体をバイパスしてはいけません。他の API はアプリ側の Bearer 認証を持たないため、全体バイパスすると保護されなくなります。

ブラウザーから `/api/mcp` を呼ぶ場合は `MCP_ALLOWED_ORIGINS` に Origin の完全一致リストを設定します。Origin ヘッダーがない MCP クライアントは許可し、Origin がある要求は許可リストにない場合に拒否します。

## クライアントキー管理

Cho は `@better-auth/api-key` と D1（`mcp_api_tokens`）を使用して `cho_mcp_...` クライアントキーを生成・検証します。設定画面（`/_app/settings`）の「MCP クライアントキー」から以下の操作を行えます。

- **キー発行**: キー名、許可ツール、有効期限（7日、30日、90日、無期限）を指定して発行します。
- **ワンタイム表示と接続スニペット**: キー本体（`cho_mcp_...`）は発行時の一度のみ表示され、Hermes CLI・MCP JSON（VS Code / Claude Desktop 用）・`curl` テストコマンドのスニペットをコピーできます。
- **キー一覧と失効**: 発行済みキーのプレフィックス、許可ツール、作成日時、有効期限、失効状態、最終利用日時を確認し、即座に失効（Revoke）できます。
- **利用状況ダッシュボード**: 過去 30 日間の UTC 日別アクティビティチャート、ツール別・キー別の呼び出し件数と最終利用日を確認できます。

MCP クライアントは `Authorization: Bearer <クライアントキー>` を付けて `POST /api/mcp` を呼び出します。なお、Cho の MCP Bearer キーは独自の事前設定方式であり、OAuth 認可サーバーは提供しません。

## 使用状況の集計とプレビュー保護

- `GET /api/mcp/usage` は直近 30 日のアクティビティサマリー（`summary`）とトークン・ツールごとの集計（`usage`）を返します。
- 登録済みツールの呼び出しは実行前にカウントされます（入力検証や処理に失敗した呼び出しも含みます）。件数を保存できない場合、ツールは実行されません。
- 引数、応答、食事データ、エラー本文、トークン文字列は使用状況テーブルに保存しません。
- PR Preview は Production D1 を共有するため、Worker 設定で `MCP_MANAGEMENT_ENABLED="false"` が設定され、トークン管理・利用状況 API は `503` で拒否されます。トークンの発行や管理は Production 環境で行ってください。
