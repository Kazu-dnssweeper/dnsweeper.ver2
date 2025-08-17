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

追加実装（M1継続）:
- ✅ `analyze`: HTTP プロービング実装（undici）/ 簡易リスク判定（low|medium|high）
- ✅ `analyze`: `--concurrency`/`--timeout`/`--summary` オプション追加
- ✅ `export`: JSON/CSV/XLSX 出力の実装（exceljs, papaparse）
- ✅ `list`: JSON入力を対象に `--min-risk` でフィルタ＆表示（cli-table3）
- ✅ `ruleset`: 雛形実装（`list`/`add`/`version`、保存先は `.tmp/rulesets`）
 - ✅ `annotate`: 実装（domain フィルタ: contains/regex、note/labels 付与）

M5（出力/進捗/監査）の進捗:
- ✅ 進捗集計と表示（processed/total, qps, avg latency, fail rate, ETA、1s間隔、`--quiet` で抑制）
- ✅ 監査ログ（JSONL）: cmd/args/inputHash(SHA-256)/rulesetVersion/nodeVersion を追記
- ✅ 監査ログの安全なフォールバック（$HOME 不可時は `.tmp/audit.log`）

次の候補:
- `npm link` によるグローバルCLI化
- `jobs`/`progress` の仕組み導入（FR/NFR: task005参照）
 
TASK-001 未達の補完状況:
- ✅ プロバイダ自動判定の雛形（Cloudflare/Route53/Generic）
- ✅ 正規化パーサ（name/type/content/ttl/proxied/aliasTarget）
- ✅ `import` 拡張：`--provider/--encoding/--errors`、失敗行を `errors.csv` に出力
- ⏳ ツールチェーン（pnpm/tsup/vitest/eslint/prettier/CI）は環境制約のため未着手（要ネット許可）
