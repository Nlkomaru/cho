# ディレクトリ

- `app/src/routes/`: TanStack Router のページとサーバールート
- `app/src/components/`: 複数画面で再利用する共有 UI
- `app/src/`: 調理記録の業務型と処理を、利用箇所に近い責務単位で配置
- `storybook/src/`: `app/src/components/` の stories

空のレイヤー、不要な barrel file、用途が一つしかない抽象化は作りません。
