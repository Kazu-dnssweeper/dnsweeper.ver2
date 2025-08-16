# M5: 出力（JSON/CSV/XLSX） & 進捗/監査

## Goal
- 大規模処理を見通せる進捗表示と、監査可能な成果物（JSON/CSV/XLSX）を安定出力。

## Scope（FR/NFR）
- FR-009, FR-010, FR-011／NFR-003, NFR-004

## Deliverables
- `src/core/output/json.ts|csv.ts|xlsx.ts|table.ts`
- `src/core/jobs/runner.ts`（進捗イベントの発火・集計）
- `src/core/audit/audit.ts`（JSON lines）
- CLI オプションの反映（--format, --quiet, --verbose）

## Tasks
- [ ] table 出力（列幅調整、level で色分けは将来）
- [ ] JSON 出力（Evidence 完全収録、スキーマ厳密）
- [ ] CSV 出力（主要列のみ、Evidence は JSON 文字列列で保持）
- [ ] XLSX 出力（Summary/High/All の 3 シート、簡易グラフは将来）
- [ ] 進捗集計（processed/total, qps, avg latency, fail rate, ETA）
- [ ] タイマで 1s 更新（--quiet で抑制）
- [ ] 監査ログ：cmd/args/inputHash/rulesetVersion/nodeVersion
- [ ] 入力ファイルの SHA-256 算出・ログ化
- [ ] 終了サマリ（件数分布、上位ルール寄与、失敗種別）
- [ ] e2e テスト：100/10k/100k の疑似データでフォーマット妥当性

## Definition of Done
- 3 形式の出力が CLI から選択可能
- 監査ログが `$HOME/.dnsweeper/audit.log` に追記される
- 進捗/統計が実測に基づき安定表示される
