# Version Control

- ユーザーの作業中の変更を revert、reset、checkout、強制 push しません。
- 秘密情報、ローカルデータ、`.dev.vars`、生成済み認証情報をコミットしません。
- ブランチ、commit、push、Issue、Pull Request、merge はユーザーから依頼された場合だけ実行します。
- コミットメッセージは変更内容を端的に表す英語の命令形にします。
- リモートと既定ブランチは操作前に実際の Git 設定から確認し、存在を仮定しません。
