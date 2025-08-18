# M13: ルールエンジン拡張 & 誤検知抑制（FP<1%）

## Goal
- R-011〜R-020 を追加し、実データで FP<1% を達成（プリセット重み/無効化の最適化）。

## Scope（FR/NFR）
- FR: 新ルール実装（SPF/DMARC/MXの弱設定、CNAME終端の品質、SRV誤設定など）
- NFR: カバレッジ維持（lines/functions/statements80%/branches70%+）、回帰防止

## Deliverables
- 新ルール群/テスト/フィクスチャ、`strict-rules` の更新
- `ruleset weights` による推奨重みセット（デフォルト/厳格）

## Tasks
- [ ] 失敗統計から誤検知が多いパターンを抽出し閾値/重みを調整
- [ ] 代表ケースの追加フィクスチャ（実データを匿名化）
- [ ] `list`/`export` に FP 分布の補助表示（オプション）

## Definition of Done
- ベンチ/実データ双方で FP<1%（定義/測定手順を文書化）を満たす
