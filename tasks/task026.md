# v0.5.0: 性能/NFR 前進（中間）

## Goal
- 10k/100k ベンチの中央値を安定化し、長い尻尾を抑制。

## Scope
- FR: timeout/ジッタ/再試行、QPSバースト/平滑、進捗/ログI/O軽量化、エラー集計。

## Deliverables
- docs/BENCHMARKS.md 更新、README 概況更新。

## Tasks
- [ ] タイムアウト/再試行/ジッタ最適化。
- [ ] QPS 平滑化とバースト制限見直し。
- [ ] 進捗計算/ログI/Oのオーバーヘッド削減。
- [ ] ベンチワークフロー整備と結果反映。

## Definition of Done
- 10k/100k の中央値が安定し、計測手順/数値がDocsに明記される。

## Timeline / Owner / Dependencies
- 期日: TBD（GitHub Milestone v0.5.0）
- 担当: Maintainers
- 依存: v0.3.0（配布/CI整備）
