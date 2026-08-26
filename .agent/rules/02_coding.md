# 実装規約

## TypeScript / React

- `strict` を維持し、`any`、非 null アサーション、二重キャストで型エラーを隠しません。
- 外部入力は境界で形式・必須項目・値域を検証し、日時は ISO 8601 UTC、ID は衝突しない方法で扱います。
- TanStack Router のファイルベースルートは `app/src/routes/` に置き、URL を変えない分類には pathless route を使用します。
- 共有 UI は `app/src/components/` の既存コンポーネントを再利用し、shadcn/ui を使う場合は `app/src/components/ui/` の既存コンポーネントを優先します。キーボード操作、フォーカス、ラベル、空状態を保ちます。
- Tailwind CSS v4 の既存トークンを使い、コンポーネント固有 CSS や状態表現の重複を避けます。
- 共有 UI の追加・変更時は、主要状態を確認できる Storybook story を `storybook/src/` に追加または更新します。

## 境界

- ルートコンポーネントに永続化や複雑な業務ルールを直接置かず、必要になった時点で責務ごとのモジュールへ分離します。
- 調理記録、材料、手順、写真などの業務データと、表示用の文言・状態を混同しません。
- Cloudflare リソースは binding 経由で利用し、秘密情報は Wrangler secrets または環境変数に置きます。
- binding を変更した場合は `pnpm --filter cho run cf-typegen` を実行します。
