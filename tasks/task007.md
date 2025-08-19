# M7: 調整 & 性能検証（最適化 / 信頼性向上）

## Goal
- 10万レコードを 15 分以内で処理（concurrency=40, 平均ネットワーク正常）し、false positive < 1% を達成。

## Scope（FR/NFR）
- NFR-001, NFR-002, NFR-003, NFR-004, NFR-006

## Deliverables
- ベンチマークスクリプト（fixtures: 100/10k/100k）
- 設定プリセット（高遅延/低遅延/厳格ルール）
- 調整レポート（ボトルネック/改善前後の比較）

## Tasks
- [x] p-limit とレートリミットの最適化（バーストと平滑の併用）
  - analyze: `qps` + `qpsBurst`（config: `analyze.qpsBurst`）で瞬間バーストと平滑化を併用。
- [x] DNS/HTTP タイムアウト/再試行のチューニング（ジッタ幅）
  - DoH: 指数バックオフ＋ジッタ（resolveDoh）。HTTP: タイムアウト/リダイレクト上限、GETフォールバック。
- [x] キャッシュヒット率の計測 & TTL 共有の見直し
  - DoH: ヒット/ミス/時間を集計しsummary出力（`[dns]`行）。TTLはNOERROR時に最小TTLで格納。
- [x] メモリプロファイル（チェイン保持の上限・ストリーム化）
  - CSVはPapaのストリーミングで処理。結果は必要最小限の保持（`--include-original`で明示拡張）。
- [x] 進捗計算のオーバーヘッド削減（更新間隔/集計粒度）
  - `JobRunner` の間隔を `analyze.progressIntervalMs`（既定1000ms, 最小200ms）で制御。
- [ ] ログ出力の I/O 最適化（バッファリング）
  - 監査ログは単発追記＋5MBローテーション。高頻度化の要件が出たらバッファリング導入検討。
- [ ] エラー種別の統計を基にルール重みを再調整
  - summaryの`[http] errors=`分布と実データを用いてweightsを再最適化（要実データ）
- [ ] 実測 10万行で 3 回連続ベンチ、中央値で NFR-001 を満たす

## Definition of Done
- NFR を満たす実測値を README に記録
- 既知の不安定要因に対する緩和策（設定プリセット）が揃う

## 備考 / 追加
- analyze に `--http-on-nxdomain` を追加（DoHがNXDOMAINでもHTTPプローブを実行可）。ベンチ標準シナリオで利用。
- ベンチは `scripts/bench/bench.js` / `scripts/bench/summarize.js` を用意。ワークフロー（bench-quick/standard）から実行可能。
