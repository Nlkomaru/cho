# Cho

Cho は、料理やお菓子作りの記録を管理するアプリです。作ったもの、材料、手順、写真、日時、感想などの記録を、後から探して振り返れる形で扱います。

## 構成

- `app/`: TanStack Start / Router、React 19、Tailwind CSS v4、Cloudflare Workers
- `storybook/`: `app/src/components/` の共有 UI を確認する Storybook

料理とお菓子を同じ「調理記録」として扱い、表示都合ではなく記録の意味を表す型と名前を使用します。
