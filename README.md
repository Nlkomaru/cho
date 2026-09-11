# Cho

料理やお菓子作りの記録を管理するアプリです。レシピ、材料とその単位換算、作った記録（日時・写真・感想・
Instagram の投稿リンク）を残せます。

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

### ローカルの準備

開発サーバーは wrangler のローカル emulation で D1 と R2 を使います（本番データには触れません）。
初回だけマイグレーションを適用し、秘密値を用意します。

```bash
pnpm --dir app exec wrangler d1 migrations apply cho --local
cp app/.dev.vars.example app/.dev.vars   # 値を入れる（.dev.vars はコミットしない）
```

`app/.dev.vars` に必要な値:

| 名前 | 内容 |
| --- | --- |
| `BETTER_AUTH_SECRET` | セッション cookie の署名鍵。`openssl rand -base64 32` で生成する |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord の OAuth2 クライアント |
| `ALLOWED_DISCORD_USER_IDS` | 新規登録を許可する Discord ユーザー id（カンマまたは空白区切り） |

## ログイン

ログインは Discord のみです。**登録できるのは `ALLOWED_DISCORD_USER_IDS` に載っている
アカウントだけで、それ以外のアカウントは登録できません**（既存ユーザーのログインは許可リストに依りません）。
許可リストが空のときは誰も新規登録できません。

データは利用者ごとに分かれます（レシピ、作った記録、材料マスタ、レシピの種類）。
初回ログイン時に、その利用者のレシピ種類・材料・換算表が自動で入ります。
他の利用者のレシピや写真は、URL を知っていても開けません。

Discord Developer Portal の OAuth2 クライアントに、次の Redirect URI を登録します。

- `http://localhost:3000/api/auth/callback/discord`
- `https://cho.nikomaru.dev/api/auth/callback/discord`

本番の秘密値は wrangler secret で設定します。

```bash
cd app
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put DISCORD_CLIENT_ID
pnpm exec wrangler secret put DISCORD_CLIENT_SECRET
pnpm exec wrangler secret put ALLOWED_DISCORD_USER_IDS
```

## レシピ JSON

レシピはフォームのほかに JSON でも入力できます。取り込みは「レシピ → 新しいレシピ」から行い、
保存済みのレシピは編集画面から同じ形式で書き出せます。

- 形式の定義（JSON Schema）: `https://cho.nikomaru.dev/schemas/recipe-v1.json`
- 実装（zod）: `app/src/domain/recipe.ts`

```json
{
  "schemaVersion": 1,
  "title": "りんごのコンポート",
  "categorySlug": "sweets",
  "summary": "さっぱりした甘さの作り置き。",
  "servings": { "value": 4, "unit": "人前" },
  "times": { "prepMinutes": 10, "cookMinutes": 20, "restMinutes": 60 },
  "ingredients": [
    { "name": "りんご", "amount": { "value": 2, "unit": "個" }, "note": "紅玉が向きます", "ingredientId": null },
    { "name": "グラニュー糖", "amount": { "value": 3, "unit": "大さじ" }, "note": null, "ingredientId": null }
  ],
  "steps": [{ "text": "りんごを 8 等分に切る。" }],
  "references": [
    { "title": "定番のお菓子 p.42", "url": null, "note": "煮る時間だけ参考にした" }
  ],
  "tags": ["作り置き"],
  "note": null
}
```

- `categorySlug` は設定画面の「レシピの種類」の slug（`sweets`、`french` など）です。
- 単位は日本語の表記（`大さじ`、`個`）でも slug（`tbsp`、`piece`）でもよく、取り込み時に slug へ正規化します。
  定義は `app/src/domain/units.ts` にあります。
- `references` は参考にした本・サイト・動画などで、1 件ごとにタイトルか URL のどちらかが必要です。
  空の配列なら自分のレシピとして扱います。
- `ingredientId` は材料マスタの id です。省略しても、材料名が材料マスタと完全一致すれば
  取り込み時に自動で結び付きます（結び付くと単位換算と Inventia へのリンクが使えます）。
- 画像はレシピ JSON には含めません。保存後の画面から追加します。

## 単位換算

材料マスタ（`/ingredients`）に密度（g/ml）と単位ごとの換算表を持たせます。

- 体積（`ml`・`大さじ`・`小さじ`・`カップ`・`合`）は密度から g を計算します。
  大さじ 15ml、小さじ 5ml、カップ 200ml、1 合 180ml として扱います。
- 密度では表せない数え方（1個 = 50g、1パック = 200g など）は換算表の行で登録します。
- レシピ詳細では「グラムで見る」の切り替えで、記録した単位と g を入れ替えて表示できます。

## データ

D1 のスキーマは `app/src/db/schema.ts` が正で、マイグレーションは `app/migrations/` に置きます。
生成は drizzle-kit、適用は wrangler の migrations コマンドを使います。

レシピ・材料マスタ・レシピの種類は `owner_id` を持ち、サーバー関数はログイン中の利用者の行だけを
読み書きします（作った記録と写真はレシピ経由で持ち主が決まります）。

```bash
pnpm --dir app exec drizzle-kit generate          # app/migrations/<番号>_<名前>.sql を生成
pnpm --dir app exec wrangler d1 migrations apply cho --local
pnpm --dir app exec wrangler d1 migrations apply cho --remote
```

better-auth が使うテーブルは better-auth CLI の生成物です。設定を変えたときは
`app/scripts/auth-cli-config.ts` を指定して再生成し、`app/src/db/schema.ts` へ反映します
（CLI のバージョンは `app/package.json` の `better-auth` に合わせます）。

```bash
cd app
pnpm dlx auth@1.7.4 generate --config ./scripts/auth-cli-config.ts --output ./scripts/auth-schema.generated.ts
```

写真は R2（`cho-images`）へ置き、D1 にはキーだけを持ちます。配信は Worker の `/images/<key>` です。

## 確認

```bash
pnpm check
pnpm build
```

`pnpm check` は app を biome で、storybook を `tsc --noEmit` で確認します。`pnpm build` は
app（Worker とクライアント）をビルドします。Storybook は別コマンドで
`storybook/storybook-static` へビルドします。

```bash
pnpm --filter ./storybook run build
```

## Cloudflare Workers

アプリは `cho` Worker で配信します（`https://cho.nikomaru.dev/`）。

binding は `app/wrangler.jsonc` で定義します（D1 `DB`、R2 `IMAGES`）。binding を変えたら
型を生成し直してください。`pnpm deploy` は app をビルドしてから `app/` の Worker をデプロイします。

```bash
pnpm cf-typegen
pnpm deploy
```

`main` への push と手動実行は `.github/workflows/deploy.yml`、Pull Request の
プレビューは `.github/workflows/preview.yml` が担当します。Storybook はプレビューでのみ
ビルドされ、`ci.nikomaru.dev/cho/<commit>/storybook/` へアップロードされます。Actions では
`BWS_ACCESS_TOKEN`、`AWS_REGION`、`S3_URL`、`BUCKET_NAME` をリポジトリ secrets に設定します。

## Theme

https://tweakcn.com/themes/cmr5kll1g000004jxcs7c0gl5?p=marketing
