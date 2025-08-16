# PROGRESS (TASK-001)

- ✅ 計画提示→承認→適用の手順を遵守
- ✅ `.nvmrc` 追加（Node.js 20 固定）
- ✅ `package.json` に `prestart`/`postinstall` を追加（自動ビルド）
- ✅ `bin/dnsweeper` の BOM 除去（shebang 安定化）
- ✅ `sample.csv` 追加（ヘッダ+2行）
- ✅ ビルド/ヘルプ確認（`npm start -- --help`）
- ✅ `analyze` 実行確認（`rows=2`）
- ✅ README 追加（セットアップ/実行手順）
- ✅ `import` コマンド実装（CSV→JSON、`--output`/`--pretty`）
- ✅ `import` コマンドの動作確認（sample.csv → JSON 出力確認）

次の候補:
- `npm link` によるグローバルCLI化
- 他コマンド実装着手（`list`/`export`/`ruleset`/`annotate`）
