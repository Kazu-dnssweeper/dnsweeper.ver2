# M11: キャッシュ永続化 & レジリエンス

## Goal
- DoH/DNS 結果のキャッシュをプロセス間で再利用し、再実行時の時間短縮と安定性を確保する。

## Scope（FR/NFR）
- FR: ファイルベースキャッシュ（TTL/Expires）、起動時ロード/終了時フラッシュ、ヒット率可視化
- NFR: 破損時の安全フェイル（自動無効化）、ロック/同時書き込み対策、サイズ上限/GC

## Deliverables
- `~/.cache/dnsweeper/doh-cache.jsonl`（デフォルト。環境変数で上書き可）
- CLI: ヒット率/推定節約時間を `--summary` 時にstderr表示
- 設定: `dnsweeper.config.json` で on/off, パス, サイズ上限, TTL上限 を制御

## Tasks
- [ ] フォーマット（JSONL/スナップショット）設計とI/O 実装
- [ ] 競合/破損の検出とフォールバック（in-memory）
- [ ] メトリクス集計と `--summary` 連携
- [ ] ドキュメント（パス/権限/無効化方法）

## Definition of Done
- キャッシュ on/off 切替で実行時間が再現性を持って短縮/無影響である
- 破損/権限不可時にも安全に継続し警告だけ出る
