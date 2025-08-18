# M10: ジョブ管理（jobs）& 進捗サービス（progress）

## Goal
- 長時間の `analyze` を安定的に扱うため、ジョブIDで開始/再開/停止/進捗参照を可能にする。

## Scope（FR/NFR）
- FR: `dnsweeper jobs start/status/cancel`、`--snapshot/--resume` の統合、JSONL進捗イベント出力
- NFR: 中断安全（再入可能）、低オーバーヘッド、標準化された監査ログ

## Deliverables
- コア: JobRegistry/JobState（pending/running/completed/failed/cancelled）
- CLI: `jobs start`（既存 analyze を内包）/`jobs status`/`jobs cancel`
- 進捗イベント: JSONL（1秒間隔/可変）に count/qps/latency/ETA/失敗率 を記録

## Tasks
- [ ] Job モデル/ストア（in-memory + file snapshot）
- [ ] analyze をジョブ実行器に統合（既存 `--snapshot/--resume` 活用）
- [ ] CLI 実装とヘルプ/使用例の追加
- [ ] 監査ログと相互参照（jobId）

## Definition of Done
- 任意の入力で `jobs start` → 中断 → `jobs status`/`jobs cancel` が期待通り動作
- 進捗JSONLの統計が `--summary` と整合し、オーバーヘッドが軽微
