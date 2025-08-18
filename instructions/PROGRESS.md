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

---

# PROGRESS (TASK-003: Risk Engine MVP)

- ✅ ルール実装: R-001〜R-010（新規: R-004/合成ヒント, R-008/CNAME終端なし, R-009/TXT弱SPF）
- ✅ 型拡張: `RiskContext.dns.chain` を追加
- ✅ しきい値設定: `dnsweeper.config.json` の `risk` で R-004 閾値を上書き可能（`lowTtlSec` 等）
- ✅ ドキュメント: `docs/RISK_ENGINE.md`（Evidence書式/ルール仕様/閾値設定/拡張方法）
- ✅ ユニットテスト拡充＋複合ケース（coverage gates → lines/functions/statements 80%, branches 70%）
- ✅ analyze連携: Risk EngineへHTTP+DNSを投影し合算（既存の NXDOMAIN→high ヒューリスティックは保持/ダウングレード抑止）

---

# PROGRESS (TASK-004: HTTP Prober & 合算スコア)

- ✅ HTTP Prober 実装: HEAD→失敗時GET、手動リダイレクト追跡、TLS最小情報（ALPN/Issuer/SNI）、失敗分類（timeout/dns/tls/net/http4xx/http5xx）
- ✅ DNS→HTTP の直列化（負荷と制御性向上）
- ✅ スキーマ拡張（任意項目）: `https.tls`, `riskScore`, `evidences`, `candidates`
- ✅ Evidence 出力: `--include-evidence` で Risk Engine の score/evidences をJSON出力
- ✅ SRV 対応: candidates 注釈＋ `--probe-srv` で必要時に追加プローブ
- ✅ 解析サマリに HTTP エラー種別の集計を追加（stderr出力）
- ✅ list 拡張: `--show-tls`/`--show-evidence`/`--show-candidates` 列を追加（table/csv/jsonで出力）
- ✅ README 更新: 新オプション（`--include-evidence`/`--probe-srv`）とTLS/HTTP集計の記載

---

# PROGRESS (CI/Operations)

- ✅ CI 分割: Unit（Push/PR自動）/ Network（手動/スケジュール）
- ✅ 安定化: pnpm キャッシュ、テストのリトライラッパ（`scripts/ci/run-with-retry.sh`）
- ✅ 自動リラン: `.github/workflows/auto-rerun-on-failure.yml`（Unit/Netを最大3attemptまでサーバ側で自動再実行）
- ✅ ローカル pre-push フック: `scripts/setup-githooks.sh` で `test:unit`+`lint` を自動実行
- ✅ SSH 運用: `setup-deploy-key.sh`/`ssh-persist.sh`/`ssh-test.sh`/`remote-to-ssh.sh`
- ✅ 片付け: `scripts/logout.sh`（DRY-RUN/--force、ローカル資格情報の削除）
- ✅ 週次の大規模フォーマット検証: `.github/workflows/ci-large.yml`（LARGE_E2E=1 で10k/100kをサイズゲート実行）

---

# PROGRESS (TASK-006: 設定 & チューニング)

- ✅ 設定スキーマ拡張: `dnsweeper.config.json`（risk thresholds/rules overrides, analyze defaults, annotate defaults）
- ✅ Risk Engine 反映: `weights`/`disabled` を `evaluateRisk` に適用
- ✅ ruleset CLI: `ruleset weights --set/--off/--on` で設定ファイルを更新
- ✅ annotate マーク付与: `--mark key:value` で `marks` をマージ
- ✅ analyze レイヤリング: configの既定（qps/concurrency/timeoutMs/dohEndpoint）をCLIで未指定時に反映
- ✅ 中断安全: `--snapshot`/`--resume` によるスナップショット保存と再開（入力ハッシュ一致時に未処理のみ）

# PROGRESS (TASK-007: 調整 & 性能検証)

- ✅ ベンチ基盤: `scripts/bench/bench.js`（CSV生成→analyze→[bench]出力）
- ✅ 設定プリセット: `examples/presets/low-latency.json` / `high-latency.json` / `strict-rules.json`
- ✅ QPSゲート微調整: バースト許容量（analyze.qpsBurst）＋平滑化ペーシング
- ⏳ 計測とレポート作成: docs/BENCHMARKS.md に手順とテンプレを用意（次は100/10k→100kの順で中央値を取得）

---

# RECENT UPDATES (2025-08-18)

- ✅ ベンチ更新/自動化（TASK-007 継続）
  - `docs/BENCHMARKS.md` に最新中央値を反映（100: ~6.1s / 10k: ~410s）。
  - `.github/workflows/bench.yml` 強化（100k×3: low-latencyのみ、`--timeout 500`/`--dns-timeout 1500`、常時サマリ/Artifact）。
  - `scripts/bench/summarize.js` 追加（ログ→中央値算出）。

- ✅ ドキュメント/仕様
  - `docs/SPEC.md` 追加（GA時点の仕様/アーキテクチャ/スキーマ/NFR等）。
  - `ROADMAP.md` 追加/更新（M8–M21 と v0.1.0〜v2.1.0+ を tasks にリンク）。

- ✅ CLI/機能
  - `jobs` コマンド追加（status/start/cancel）。
  - スナップショットに `meta.total/processed` 追記（jobs status で%表示）。

- ✅ CI/配布
  - Cross-OS スモーク追加（`.github/workflows/ci-os.yml`）。
  - Release ワークフロー追加（`.github/workflows/release.yml`）。

- ✅ 計画/追跡（GitHub）
  - Milestones 作成: v0.1.0 / v0.3.0 / v0.5.0（due_on設定）。
  - Tracking Issues 作成: #2/#3/#4（各Milestone）。
  - 集約PR #5（v0.1.0 Preview）作成→マージ（squash）。

- ✅ README 更新
  - ベンチ概況（最新中央値）への更新、関連ドキュメントへの導線強化。

- 🧭 User-side Tasks（tasks各所に追記）
  - アカウント/Secrets/SSO、宣伝/LP、法務、課金等を各フェーズに割当（tasks/task0xx.md 参照）。
